import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AiUnavailableError,
  DeepSeekGateway,
  FakeAiGateway,
  parseChatStream,
  splitForStream,
  type AiStreamEvent,
} from './ai-gateway.js';

// T4.5: o gateway em streaming. O DeepSeek real só dá pra provar com chave; aqui o `fetch` é mockado e a gente
// confere o parser do SSE (pedaços quebrados, ferramentas fatiadas, erros) e o fallback do FakeAiGateway.

const enc = new TextEncoder();
/** Corpo SSE que entrega os pedaços de texto do jeito (quebrado) que a rede entregaria. */
const body = (parts: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of parts) c.enqueue(enc.encode(p));
      c.close();
    },
  });
const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
const text = (t: string) => sse({ choices: [{ delta: { content: t } }] });
const collect = async (gen: AsyncGenerator<AiStreamEvent, void, undefined>) => {
  const out: AiStreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
};

afterEach(() => vi.unstubAllGlobals());

describe('parseChatStream (SSE do DeepSeek)', () => {
  it('junta o texto em ordem e termina no [DONE]', async () => {
    const events = await collect(parseChatStream(body([text('Oi, '), text('tudo bem?'), 'data: [DONE]\n\n'])));
    expect(events).toEqual([
      { type: 'delta', text: 'Oi, ' },
      { type: 'delta', text: 'tudo bem?' },
    ]);
  });

  it('aguenta linha cortada no meio entre dois pedaços da rede e CRLF', async () => {
    const line = text('Olá mundo');
    const events = await collect(
      parseChatStream(body([line.slice(0, 15), line.slice(15, 40).replace('\n\n', '\r\n\r\n'), line.slice(40)])),
    );
    expect(events).toEqual([{ type: 'delta', text: 'Olá mundo' }]);
  });

  it('ignora comentário/keep-alive, linhas vazias e chunk sem texto (ex.: só o role)', async () => {
    const events = await collect(
      parseChatStream(
        body([
          ': keep-alive\n\n',
          sse({ choices: [{ delta: { role: 'assistant', content: '' } }] }),
          text('ok'),
          'data: [DONE]\n\n',
        ]),
      ),
    );
    expect(events).toEqual([{ type: 'delta', text: 'ok' }]);
  });

  it('ferramenta fatiada em vários pedaços vira UMA chamada completa, só no fim', async () => {
    const tc = (extra: object) => sse({ choices: [{ delta: { tool_calls: [{ index: 0, ...extra }] } }] });
    const events = await collect(
      parseChatStream(
        body([
          tc({ id: 'call_9', function: { name: 'consultar_gastos_', arguments: '' } }),
          tc({ function: { name: 'categoria', arguments: '{"categ' } }),
          tc({ function: { arguments: 'oria":"Delivery"}' } }),
          'data: [DONE]\n\n',
        ]),
      ),
    );
    expect(events).toEqual([
      {
        type: 'tool_calls',
        toolCalls: [
          {
            id: 'call_9',
            type: 'function',
            function: { name: 'consultar_gastos_categoria', arguments: '{"categoria":"Delivery"}' },
          },
        ],
      },
    ]);
  });

  it('duas ferramentas na mesma rodada saem na ordem do index', async () => {
    const tcs = sse({
      choices: [
        {
          delta: {
            tool_calls: [
              { index: 1, id: 'b', function: { name: 'consultar_meta', arguments: '{}' } },
              { index: 0, id: 'a', function: { name: 'verificar_limite_categoria', arguments: '{}' } },
            ],
          },
        },
      ],
    });
    const [ev] = await collect(parseChatStream(body([tcs])));
    expect(ev).toMatchObject({ type: 'tool_calls' });
    expect((ev as Extract<AiStreamEvent, { type: 'tool_calls' }>).toolCalls.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('sem texto e sem ferramenta = resposta vazia (AiUnavailableError), como no chat normal', async () => {
    await expect(collect(parseChatStream(body(['data: [DONE]\n\n'])))).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it('JSON quebrado no meio do stream vira AiUnavailableError (nunca texto de lixo na tela)', async () => {
    await expect(collect(parseChatStream(body([text('a'), 'data: {nao-e-json\n\n'])))).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
  });

  it('conexão que cai no meio do corpo vira AiUnavailableError', async () => {
    const broken = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode(text('Você ')));
      },
      pull() {
        throw new Error('ECONNRESET');
      },
    });
    const seen: AiStreamEvent[] = [];
    const run = async () => {
      for await (const e of parseChatStream(broken)) seen.push(e);
    };
    await expect(run()).rejects.toBeInstanceOf(AiUnavailableError);
    expect(seen).toEqual([{ type: 'delta', text: 'Você ' }]); // o que já chegou foi entregue
  });
});

describe('DeepSeekGateway.chatStream', () => {
  const gateway = new DeepSeekGateway('chave-de-teste', 'deepseek-chat', 'https://api.exemplo.test');

  it('pede stream:true com as ferramentas e o token, e devolve os pedaços', async () => {
    const fetchMock = vi.fn(async () => new Response(body([text('Oi'), 'data: [DONE]\n\n']), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const tools = [{ type: 'function' as const, function: { name: 'x', description: 'd', parameters: {} } }];
    const events = await collect(gateway.chatStream([{ role: 'user', content: 'oi' }], { tools }));

    expect(events).toEqual([{ type: 'delta', text: 'Oi' }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.exemplo.test/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer chave-de-teste');
    expect(JSON.parse(init.body as string)).toMatchObject({ stream: true, model: 'deepseek-chat', tools });
  });

  it('status de erro do provedor = AiUnavailableError (o chat mostra "travou", sem vazar detalhe)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"quota"}', { status: 429 })),
    );
    await expect(collect(gateway.chatStream([{ role: 'user', content: 'oi' }]))).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
  });

  it('falha de rede / timeout = AiUnavailableError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(collect(gateway.chatStream([{ role: 'user', content: 'oi' }]))).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
  });

  it('repassa o cancelamento: abortar o signal derruba o fetch', async () => {
    let received: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        received = init.signal as AbortSignal;
        return new Promise<Response>((_, reject) =>
          received!.addEventListener('abort', () => reject(new DOMException('abort', 'AbortError'))),
        );
      }),
    );
    const ctl = new AbortController();
    const run = collect(gateway.chatStream([{ role: 'user', content: 'oi' }], { signal: ctl.signal }));
    ctl.abort();
    await expect(run).rejects.toBeInstanceOf(AiUnavailableError);
    expect(received?.aborted).toBe(true);
  });
});

describe('FakeAiGateway.chatStream (sem chave)', () => {
  it('quebra o texto em palavras e a soma é exatamente a resposta', async () => {
    const ai = new FakeAiGateway();
    ai.next = 'Seu delivery subiu 20% este mês.';
    const events = await collect(ai.chatStream([{ role: 'user', content: 'oi' }]));
    expect(events.length).toBeGreaterThan(3);
    expect(events.map((e) => (e as { text: string }).text).join('')).toBe(ai.next);
  });

  it('sem nada configurado, devolve o aviso honesto (nunca quebra)', async () => {
    const events = await collect(new FakeAiGateway().chatStream([{ role: 'user', content: 'oi' }]));
    expect(events.map((e) => (e as { text: string }).text).join('')).toContain('sem cérebro ligado');
  });

  it('repassa as ferramentas da fila de respostas', async () => {
    const ai = new FakeAiGateway();
    ai.queue.push({
      content: null,
      toolCalls: [{ id: 'c1', type: 'function', function: { name: 'consultar_meta', arguments: '{}' } }],
    });
    const events = await collect(ai.chatStream([{ role: 'user', content: 'oi' }]));
    expect(events).toEqual([
      {
        type: 'tool_calls',
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'consultar_meta', arguments: '{}' } }],
      },
    ]);
  });
});

describe('splitForStream', () => {
  it('preserva espaços e quebras de linha (a lista com "-" não pode se desfazer)', () => {
    const t = 'Resumo:\n- Mercado R$ 300\n- Delivery R$ 120';
    expect(splitForStream(t).join('')).toBe(t);
  });
});

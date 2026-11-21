import { describe, expect, it, vi } from 'vitest';
import type { ChatStreamEvent } from '@tostao/contracts';
import { EMPTY_STREAM_VIEW, createSseParser, reduceStreamView, runChatStream, type StreamOutcome } from './chat-stream';

const done: Extract<ChatStreamEvent, { type: 'done' }> = {
  type: 'done',
  question: { id: 'q1', role: 'user', content: 'oi', createdAt: '2026-11-21T12:00:00.000Z' },
  reply: { id: 'r1', role: 'assistant', content: 'Oi!', createdAt: '2026-11-21T12:00:01.000Z' },
  remainingToday: 39,
  pendingAction: null,
  followUps: ['a', 'b'],
  cards: [],
};
const line = (e: ChatStreamEvent) => `data: ${JSON.stringify(e)}\n\n`;

describe('createSseParser', () => {
  it('entrega só eventos completos, mesmo com a rede cortando no meio da linha', () => {
    const parse = createSseParser();
    const raw = line({ type: 'status', text: 'Pensando...' }) + line({ type: 'delta', text: 'Oi' });
    expect(parse(raw.slice(0, 20))).toEqual([]);
    expect(parse(raw.slice(20, raw.length - 3))).toEqual([{ type: 'status', text: 'Pensando...' }]);
    expect(parse(raw.slice(raw.length - 3))).toEqual([{ type: 'delta', text: 'Oi' }]);
  });

  it('vários eventos no mesmo pedaço e CRLF', () => {
    const parse = createSseParser();
    const raw = (line({ type: 'delta', text: 'a' }) + line({ type: 'delta', text: 'b' })).replace(/\n/g, '\r\n');
    expect(parse(raw)).toEqual([
      { type: 'delta', text: 'a' },
      { type: 'delta', text: 'b' },
    ]);
  });

  it('ignora keep-alive, JSON quebrado, tipo desconhecido e evento sem os campos obrigatórios', () => {
    const parse = createSseParser();
    const raw =
      ': ping\n\n' +
      'data: {quebrado\n\n' +
      'data: {"type":"hackeado","text":"x"}\n\n' +
      'data: {"type":"delta"}\n\n' +
      'data: {"type":"done","reply":{}}\n\n' +
      line({ type: 'delta', text: 'ok' });
    expect(parse(raw)).toEqual([{ type: 'delta', text: 'ok' }]);
  });
});

describe('reduceStreamView', () => {
  it('status aparece enquanto não há texto; o texto vai somando e o status some', () => {
    let v = reduceStreamView(EMPTY_STREAM_VIEW, { type: 'status', text: 'Consultando seu extrato...' });
    expect(v).toEqual({ status: 'Consultando seu extrato...', text: '' });
    v = reduceStreamView(v, { type: 'delta', text: 'Você ' });
    v = reduceStreamView(v, { type: 'delta', text: 'gastou.' });
    expect(v).toEqual({ status: null, text: 'Você gastou.' });
  });
});

describe('runChatStream', () => {
  const sseResponse = (chunks: string[], init: ResponseInit = {}) =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          const enc = new TextEncoder();
          for (const ch of chunks) c.enqueue(enc.encode(ch));
          c.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' }, ...init },
    );
  const run = (fetchImpl: typeof fetch, signal?: AbortSignal) => {
    const seen: ChatStreamEvent[] = [];
    return runChatStream({ message: 'oi', fetchImpl, signal, onEvent: (e) => seen.push(e) }).then(
      (outcome) => ({ outcome, seen }) as { outcome: StreamOutcome; seen: ChatStreamEvent[] },
    );
  };

  it('caminho feliz: eventos na ordem e termina com done', async () => {
    const f = vi.fn(async () =>
      sseResponse([line({ type: 'status', text: 'Pensando...' }), line({ type: 'delta', text: 'Oi!' }), line(done)]),
    );
    const { outcome, seen } = await run(f as unknown as typeof fetch);
    expect(outcome).toEqual({ kind: 'done', event: done });
    expect(seen.map((e) => e.type)).toEqual(['status', 'delta', 'done']);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/chat/stream');
    expect(JSON.parse(init.body as string)).toEqual({ message: 'oi' });
  });

  it('fallback: rede caiu antes de responder', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect((await run(f as unknown as typeof fetch)).outcome).toEqual({ kind: 'fallback' });
  });

  it('fallback: 404/5xx/HTML do proxy e 200 que não é SSE', async () => {
    for (const res of [
      new Response('<html>Bad Gateway</html>', { status: 502 }),
      new Response('{"message":"x"}', { status: 500, headers: { 'content-type': 'application/json' } }),
      new Response('nao achei', { status: 404 }),
      new Response('<html>ok</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    ]) {
      expect((await run((async () => res) as unknown as typeof fetch)).outcome).toEqual({ kind: 'fallback' });
    }
  });

  it('LGPD: 403 AI_CONSENT_REQUIRED vira "consent" (a tela mostra o aviso), sem fallback que repetiria a pergunta', async () => {
    const res = () =>
      new Response(JSON.stringify({ message: 'Aceite o aviso', code: 'AI_CONSENT_REQUIRED' }), { status: 403 });
    expect((await run((async () => res()) as unknown as typeof fetch)).outcome).toEqual({
      kind: 'consent',
      message: 'Aceite o aviso',
    });
  });

  it('401 = sessão vencida; 429 e 400 mostram a mensagem da API', async () => {
    expect((await run((async () => new Response('', { status: 401 })) as unknown as typeof fetch)).outcome).toEqual({
      kind: 'unauthorized',
    });
    const quota = () => new Response(JSON.stringify({ message: 'Por hoje deu' }), { status: 429 });
    expect((await run((async () => quota()) as unknown as typeof fetch)).outcome).toEqual({
      kind: 'error',
      message: 'Por hoje deu',
    });
  });

  it('evento de erro do servidor: encerra com a mensagem, sem done', async () => {
    const f = async () =>
      sseResponse([
        line({ type: 'delta', text: 'Você ' }),
        line({ type: 'error', message: 'O Tostão travou pensando.', status: 503 }),
      ]);
    const { outcome } = await run(f as unknown as typeof fetch);
    expect(outcome).toEqual({ kind: 'error', message: 'O Tostão travou pensando.' });
  });

  it('caiu NO MEIO (já veio texto, sem done): "interrupted", e NÃO cai no fallback (não repete a pergunta)', async () => {
    const f = async () =>
      sseResponse([line({ type: 'status', text: 'Pensando...' }), line({ type: 'delta', text: 'Você ' })]);
    expect((await run(f as unknown as typeof fetch)).outcome).toEqual({ kind: 'interrupted' });
  });

  it('abriu mas fechou sem mandar nenhum evento: ainda é fallback (nada chegou a acontecer)', async () => {
    expect((await run((async () => sseResponse([])) as unknown as typeof fetch)).outcome).toEqual({ kind: 'fallback' });
  });

  it('abort da pessoa (trocou de tela, cancelou): "aborted", nunca fallback', async () => {
    const ctl = new AbortController();
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      ctl.abort();
      throw new DOMException('abort', 'AbortError');
      void init;
    });
    expect((await run(f as unknown as typeof fetch, ctl.signal)).outcome).toEqual({ kind: 'aborted' });
  });
});

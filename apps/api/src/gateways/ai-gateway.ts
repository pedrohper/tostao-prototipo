// Porta pro modelo de IA. Hoje: DeepSeek (API no formato da OpenAI). Trocar de provedor = outra classe.
export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ChatTurn =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type AiReply = {
  content: string | null;
  toolCalls: ToolCall[];
};

/** Pedaço de uma resposta em streaming: texto chegando, ou (no fim) as ferramentas que o modelo quer usar. */
export type AiStreamEvent = { type: 'delta'; text: string } | { type: 'tool_calls'; toolCalls: ToolCall[] };

export interface AiGateway {
  /** null = IA não configurada (sem chave). */
  readonly enabled: boolean;
  reply(messages: ChatTurn[], opts?: AiOptions): Promise<string>;
  chat(messages: ChatTurn[], opts?: AiOptions): Promise<AiReply>;
  /** Mesma conversa de `chat`, mas o texto chega aos poucos. Falha = AiUnavailableError (antes ou no meio). */
  chatStream(messages: ChatTurn[], opts?: AiOptions): AsyncGenerator<AiStreamEvent, void, undefined>;
}

export type AiOptions = {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  tools?: ToolDefinition[];
  /** Cancela a chamada (pessoa fechou a aba, turno estourou o tempo). */
  signal?: AbortSignal;
};

export class AiUnavailableError extends Error {}

/** Sem chave: responde algo honesto em vez de quebrar. Também é o que os testes usam. */
export class FakeAiGateway implements AiGateway {
  calls: ChatTurn[][] = [];
  /** Resposta fixa opcional (testes da categorização automática). Com ela, finge que a IA tá ligada. */
  next: string | null = null;
  /** Fila de respostas estruturadas (pra testar loop de tool_calls). */
  queue: AiReply[] = [];
  get enabled() {
    return this.next !== null || this.queue.length > 0;
  }

  async reply(messages: ChatTurn[], _opts?: AiOptions) {
    this.calls.push(messages);
    if (this.next !== null) return this.next;
    return 'Ainda tô sem cérebro ligado aqui (falta a chave da IA no servidor). Mas seus números tão todos na Carteira e no Início!';
  }

  async chat(messages: ChatTurn[], opts?: AiOptions): Promise<AiReply> {
    if (this.queue.length > 0) {
      this.calls.push(messages);
      return this.queue.shift()!;
    }
    const content = await this.reply(messages, opts);
    return { content, toolCalls: [] };
  }

  /** Sem IA de verdade, ainda assim "digita": quebra a resposta em pedaços pra a tela exercitar o mesmo caminho. */
  async *chatStream(messages: ChatTurn[], opts?: AiOptions): AsyncGenerator<AiStreamEvent, void, undefined> {
    const res = await this.chat(messages, opts);
    if (res.content) for (const text of splitForStream(res.content)) yield { type: 'delta', text };
    if (res.toolCalls.length > 0) yield { type: 'tool_calls', toolCalls: res.toolCalls };
  }
}

/** "Oi, tudo bem?" -> ["Oi, ", "tudo ", "bem?"] (cada palavra com o espaço que vem depois). */
export function splitForStream(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [text];
}

type RawToolCallDelta = { index?: number; id?: string; function?: { name?: string; arguments?: string } };
type RawStreamChunk = { choices?: { delta?: { content?: string | null; tool_calls?: RawToolCallDelta[] } }[] };

/**
 * Lê o corpo SSE da API (formato OpenAI: linhas `data: {json}` e `data: [DONE]`) e devolve texto e ferramentas.
 * As ferramentas chegam fatiadas (nome numa linha, argumentos em vários pedaços): juntamos por `index` e só
 * entregamos no fim. Resposta sem texto e sem ferramenta = erro, como na chamada normal.
 */
export async function* parseChatStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AiStreamEvent, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const calls = new Map<number, { id: string; name: string; args: string }>();
  let buffer = '';
  let gotText = false;
  let finished = false;

  const handleLine = (line: string): AiStreamEvent | null => {
    if (!line.startsWith('data:')) return null; // comentário (": keep-alive"), event: ou linha vazia
    const payload = line.slice(5).trim();
    if (!payload) return null;
    if (payload === '[DONE]') {
      finished = true;
      return null;
    }
    let chunk: RawStreamChunk;
    try {
      chunk = JSON.parse(payload) as RawStreamChunk;
    } catch {
      throw new AiUnavailableError('pedaço inválido no streaming');
    }
    const delta = chunk.choices?.[0]?.delta;
    for (const tc of delta?.tool_calls ?? []) {
      const i = tc.index ?? 0;
      const cur = calls.get(i) ?? { id: '', name: '', args: '' };
      if (tc.id) cur.id = tc.id;
      if (tc.function?.name) cur.name += tc.function.name;
      if (tc.function?.arguments) cur.args += tc.function.arguments;
      calls.set(i, cur);
    }
    if (delta?.content) {
      gotText = true;
      return { type: 'delta', text: delta.content };
    }
    return null;
  };

  try {
    while (!finished) {
      let read: ReadableStreamReadResult<Uint8Array>;
      try {
        read = await reader.read();
      } catch {
        throw new AiUnavailableError('streaming interrompido');
      }
      if (read.done) break;
      buffer += decoder.decode(read.value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        const ev = handleLine(line);
        if (ev) yield ev;
        if (finished) break;
      }
    }
    if (!finished && buffer.trim()) {
      const ev = handleLine(buffer.replace(/\r$/, ''));
      if (ev) yield ev;
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }

  const toolCalls = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, c], i) => ({
      id: c.id || `call_${i}`,
      type: 'function' as const,
      function: { name: c.name, arguments: c.args },
    }))
    .filter((c) => c.function.name);
  if (toolCalls.length > 0) yield { type: 'tool_calls', toolCalls };
  else if (!gotText) throw new AiUnavailableError('resposta vazia');
}

export class DeepSeekGateway implements AiGateway {
  readonly enabled = true;
  constructor(
    private readonly apiKey: string,
    private readonly model = 'deepseek-chat',
    private readonly baseUrl = 'https://api.deepseek.com',
  ) {}

  async reply(messages: ChatTurn[], opts: AiOptions = {}) {
    const { content } = await this.chat(messages, opts);
    if (!content) throw new AiUnavailableError('resposta vazia');
    return content;
  }

  async chat(messages: ChatTurn[], opts: AiOptions = {}): Promise<AiReply> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: opts.temperature ?? 0.6,
          max_tokens: opts.maxTokens ?? 700,
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
          ...(opts.tools?.length ? { tools: opts.tools } : {}),
        }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      throw new AiUnavailableError('timeout');
    }
    if (!res.ok) throw new AiUnavailableError(`DeepSeek respondeu ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    };
    const msg = data.choices?.[0]?.message;
    const content = msg?.content?.trim() || null;
    const toolCalls = msg?.tool_calls ?? [];
    if (!content && toolCalls.length === 0) throw new AiUnavailableError('resposta vazia');
    return { content, toolCalls };
  }
  async *chatStream(messages: ChatTurn[], opts: AiOptions = {}): AsyncGenerator<AiStreamEvent, void, undefined> {
    const timeout = AbortSignal.timeout(45_000);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          temperature: opts.temperature ?? 0.6,
          max_tokens: opts.maxTokens ?? 700,
          ...(opts.tools?.length ? { tools: opts.tools } : {}),
        }),
        signal: opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout,
      });
    } catch {
      throw new AiUnavailableError('timeout');
    }
    if (!res.ok || !res.body) throw new AiUnavailableError(`DeepSeek respondeu ${res.status}`);
    yield* parseChatStream(res.body);
  }
}

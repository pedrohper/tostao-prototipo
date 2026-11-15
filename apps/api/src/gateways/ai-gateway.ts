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

export interface AiGateway {
  /** null = IA não configurada (sem chave). */
  readonly enabled: boolean;
  reply(messages: ChatTurn[], opts?: AiOptions): Promise<string>;
  chat(messages: ChatTurn[], opts?: AiOptions): Promise<AiReply>;
}

export type AiOptions = { temperature?: number; maxTokens?: number; json?: boolean; tools?: ToolDefinition[] };

export class AiUnavailableError extends Error {}

/** Sem chave: responde algo honesto em vez de quebrar. Também é o que os testes usam. */
export class FakeAiGateway implements AiGateway {
  calls: ChatTurn[][] = [];
  /** Resposta fixa opcional (testes da categorização automática). Com ela, finge que a IA tá ligada. */
  next: string | null = null;
  /** Fila de respostas estruturadas (pra testar loop de tool_calls). */
  queue: AiReply[] = [];
  get enabled() { return this.next !== null || this.queue.length > 0; }

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
}

export class DeepSeekGateway implements AiGateway {
  readonly enabled = true;
  constructor(private readonly apiKey: string, private readonly model = 'deepseek-chat', private readonly baseUrl = 'https://api.deepseek.com') {}

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
}

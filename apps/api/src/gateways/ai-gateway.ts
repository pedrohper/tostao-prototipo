// Porta pro modelo de IA. Hoje: DeepSeek (API no formato da OpenAI). Trocar de provedor = outra classe.
export type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string };

export interface AiGateway {
  /** null = IA não configurada (sem chave). */
  readonly enabled: boolean;
  reply(messages: ChatTurn[], opts?: AiOptions): Promise<string>;
}

export type AiOptions = { temperature?: number; maxTokens?: number; json?: boolean };

export class AiUnavailableError extends Error {}

/** Sem chave: responde algo honesto em vez de quebrar. Também é o que os testes usam. */
export class FakeAiGateway implements AiGateway {
  calls: ChatTurn[][] = [];
  /** Resposta fixa opcional (testes da categorização automática). Com ela, finge que a IA tá ligada. */
  next: string | null = null;
  get enabled() { return this.next !== null; }
  async reply(messages: ChatTurn[], _opts?: AiOptions) {
    this.calls.push(messages);
    if (this.next !== null) return this.next;
    return 'Ainda tô sem cérebro ligado aqui (falta a chave da IA no servidor). Mas seus números tão todos na Carteira e no Início!';
  }
}

export class DeepSeekGateway implements AiGateway {
  readonly enabled = true;
  constructor(private readonly apiKey: string, private readonly model = 'deepseek-chat', private readonly baseUrl = 'https://api.deepseek.com') {}

  async reply(messages: ChatTurn[], opts: AiOptions = {}) {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, messages, temperature: opts.temperature ?? 0.6, max_tokens: opts.maxTokens ?? 700, ...(opts.json ? { response_format: { type: 'json_object' } } : {}) }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      throw new AiUnavailableError('timeout');
    }
    if (!res.ok) throw new AiUnavailableError(`DeepSeek respondeu ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new AiUnavailableError('resposta vazia');
    return text;
  }
}

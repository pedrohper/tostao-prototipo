// Porta pro modelo de IA. Hoje: DeepSeek (API no formato da OpenAI). Trocar de provedor = outra classe.
export type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string };

export interface AiGateway {
  /** null = IA não configurada (sem chave). */
  readonly enabled: boolean;
  reply(messages: ChatTurn[]): Promise<string>;
}

export class AiUnavailableError extends Error {}

/** Sem chave: responde algo honesto em vez de quebrar. Também é o que os testes usam. */
export class FakeAiGateway implements AiGateway {
  readonly enabled = false;
  calls: ChatTurn[][] = [];
  async reply(messages: ChatTurn[]) {
    this.calls.push(messages);
    return 'Ainda tô sem cérebro ligado aqui (falta a chave da IA no servidor). Mas seus números tão todos na Carteira e no Início!';
  }
}

export class DeepSeekGateway implements AiGateway {
  readonly enabled = true;
  constructor(private readonly apiKey: string, private readonly model = 'deepseek-chat', private readonly baseUrl = 'https://api.deepseek.com') {}

  async reply(messages: ChatTurn[]) {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, messages, temperature: 0.6, max_tokens: 700 }),
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

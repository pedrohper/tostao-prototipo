import type { Repositories } from '../repositories/types.js';
import type { AiGateway } from '../gateways/ai-gateway.js';
import { NEUTRAL_CATEGORY_ID } from '../domain/entities.js';
import { AiConsentRequiredError, AppError } from '../domain/errors.js';
import { testOnlyKeyValueStore, type KeyValueStore } from '../lib/redis.js';
import { isPersonalTransfer, scrubFinancialText } from '../services/pii-scrubber.js';
import { canUseCategory } from './categories.js';
import { patternFromDescription } from '../services/categorize.js';
import type { Transaction } from '../domain/entities.js';

const BATCH = 40;
const MAX_PER_RUN = 200;
const DAY_SECONDS = 24 * 60 * 60;
/** Execuções por pessoa por dia que realmente chamam a IA (controle de custo). Manual: o botão. Background: sync/cron. */
export const AUTO_CATEGORIZE_DAILY_LIMIT = { user: 3, background: 6 } as const;
export type AutoCategorizeSource = keyof typeof AUTO_CATEGORIZE_DAILY_LIMIT;

const SYSTEM = `Você categoriza transações de extrato bancário brasileiro.
Recebe a lista de categorias (id, nome, tipo) e transações (id, descrição, valor em R$; negativo = saída).
Responda SÓ um JSON: {"t": {"<id da transação>": "<id da categoria>" ou null}}.
Regras:
- Saída (valor negativo) só vai pra categoria de tipo "saida"; entrada (positivo) só pra "entrada".
- Se a descrição for só nome de pessoa (Pix/TED pra alguém), código sem sentido, ou você não tiver certeza: null.
- Use o que você sabe de lojas e serviços do Brasil (ex.: iFood = delivery, Uber/99 = transporte, Drogasil = saúde).
- "outros" e "entrada-outros" não são lixeira: se não sabe, é null.
- "salario" só pra salário/folha de pagamento claro (ex.: "SALARIO", "FOLHA", "PAGTO SALARIO"). Rendimento de investimento ou cofrinho vai pra "entrada-outros".
- Estorno, reembolso ou devolução de compra: null.
- Nunca invente id de categoria.`;

/**
 * Categoria automática com a IA pras transações que as regras não pegaram.
 * Só aceita resposta válida (categoria existe e combina com entrada/saída). Na dúvida, deixa pendente.
 * Não cria regra: se a IA errar, a pessoa corrige e aí sim vira regra.
 */
export class AutoCategorizeUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'users'>,
    private readonly ai: AiGateway,
    private readonly kv: KeyValueStore = testOnlyKeyValueStore(),
    private readonly log: (message: string, meta?: Record<string, unknown>) => void = (m, meta) =>
      console.warn(m, meta ?? ''),
  ) {}

  private readonly running = new Set<string>();

  /**
   * `source: 'user'` = a pessoa pediu (botão, "Categorizar" do achado): cota de 3/dia, estoura com 429.
   * `source: 'background'` (padrão) = sync/cron: cota própria, estoura em silêncio.
   * `requireConsent: true` = sem aceite do aviso de IA responde 403 (o botão); false = pula em silêncio (rotinas).
   */
  async execute({
    userId,
    source = 'background',
    requireConsent = false,
  }: {
    userId: string;
    source?: AutoCategorizeSource;
    requireConsent?: boolean;
  }): Promise<{ categorized: number; asked: number; skipped?: 'consent' | 'quota' }> {
    if (!this.ai.enabled || this.running.has(userId)) return { categorized: 0, asked: 0 };
    // LGPD: sem consentimento, nenhuma descrição sai pro provedor de IA.
    const user = await this.repos.users.findById(userId);
    if (!user?.aiConsentAt) {
      if (requireConsent) throw new AiConsentRequiredError();
      return { categorized: 0, asked: 0, skipped: 'consent' };
    }
    this.running.add(userId);
    try {
      return await this.run(userId, source);
    } finally {
      this.running.delete(userId);
    }
  }

  private async run(userId: string, source: AutoCategorizeSource) {
    const [pending, categories] = await Promise.all([
      this.repos.transactions.findUncategorized(userId),
      this.repos.categories.list(userId),
    ]);
    const usable = categories.filter(
      (c) => canUseCategory(c, userId) && c.id !== NEUTRAL_CATEGORY_ID && c.kind !== 'neutra',
    );
    const byId = new Map(usable.map((c) => [c.id, c]));
    const todo = pending
      // Pix/TED puro pra pessoa a IA não categoriza mesmo: nem manda (economiza e não expõe o nome).
      .filter((t) => !t.isInternalTransfer && t.amountInCents !== 0 && !isPersonalTransfer(t.description))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, MAX_PER_RUN);
    // Mesma descrição (sem data/código) e mesmo sinal = uma pergunta só, e a mesma categoria pra todas.
    const groups = new Map<string, Transaction[]>();
    for (const t of todo) {
      const key = `${t.amountInCents < 0 ? '-' : '+'}${patternFromDescription(t.description) || t.description}`;
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    const items = [...groups.values()];
    if (items.length === 0) return { categorized: 0, asked: 0 };

    // Cota diária, reservada antes da 1ª chamada à IA (INCR é atômico).
    const quotaKey = `ai:autocat:${source}:${userId}`;
    const limit = AUTO_CATEGORIZE_DAILY_LIMIT[source];
    if ((await this.kv.incr(quotaKey, DAY_SECONDS)) > limit) {
      await this.kv.decr(quotaKey);
      if (source === 'user')
        throw new AppError(`Já categorizei ${limit} vezes hoje. Amanhã eu tento de novo, ou categoriza na mão.`, 429);
      return { categorized: 0, asked: 0, skipped: 'quota' as const };
    }
    const cats = usable.map((c) => `${c.id}|${c.name}|${c.kind}`).join('\n');
    let categorized = 0;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      const list = batch
        .map(
          (g, k) =>
            `${k}|${scrubFinancialText(g[0]!.description).slice(0, 90)}|${(g[0]!.amountInCents / 100).toFixed(2)}`,
        )
        .join('\n');
      let answer: Record<string, unknown>;
      try {
        const raw = await this.ai.reply(
          [
            { role: 'system', content: SYSTEM },
            {
              role: 'user',
              content: `CATEGORIAS (id|nome|tipo):\n${cats}\n\nTRANSAÇÕES (id|descrição|valor):\n${list}`,
            },
          ],
          { temperature: 0, maxTokens: 1500, json: true },
        );
        const parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim()) as { t?: Record<string, unknown> };
        answer = parsed.t ?? {};
      } catch (err) {
        // IA fora ou resposta estranha: fica pendente, tenta no próximo sync. Loga só o tipo (nunca a descrição).
        this.log('[ia] categorização automática falhou', {
          userId,
          batch: i / BATCH,
          error: err instanceof Error ? err.name : 'desconhecido',
        });
        continue;
      }
      for (const [k, catId] of Object.entries(answer)) {
        const group = batch[Number(k)];
        const cat = typeof catId === 'string' ? byId.get(catId) : undefined;
        if (!group || !cat) continue;
        const sign = group[0]!.amountInCents;
        if ((sign < 0 && cat.kind !== 'saida') || (sign > 0 && cat.kind !== 'entrada')) continue;
        // Um UPDATE por grupo, só nos que continuam sem categoria (a pessoa pode ter categorizado enquanto isso).
        categorized += await this.repos.transactions.categorizeUncategorized(
          userId,
          group.map((t) => t.id),
          cat.id,
        );
      }
    }
    return { categorized, asked: todo.length };
  }
}

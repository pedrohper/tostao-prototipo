import type { Repositories } from '../repositories/types.js';
import type { AiGateway } from '../gateways/ai-gateway.js';
import { NEUTRAL_CATEGORY_ID } from '../domain/entities.js';
import { canUseCategory } from './categories.js';
import { patternFromDescription } from '../services/categorize.js';
import type { Transaction } from '../domain/entities.js';

const BATCH = 40;
const MAX_PER_RUN = 200;

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
  constructor(private readonly repos: Pick<Repositories, 'transactions' | 'categories'>, private readonly ai: AiGateway) {}

  private readonly running = new Set<string>();

  async execute({ userId }: { userId: string }) {
    if (!this.ai.enabled || this.running.has(userId)) return { categorized: 0, asked: 0 };
    this.running.add(userId);
    try {
      return await this.run(userId);
    } finally {
      this.running.delete(userId);
    }
  }

  private async run(userId: string) {
    const [pending, categories] = await Promise.all([this.repos.transactions.findUncategorized(userId), this.repos.categories.list(userId)]);
    const usable = categories.filter((c) => canUseCategory(c, userId) && c.id !== NEUTRAL_CATEGORY_ID && c.kind !== 'neutra');
    const byId = new Map(usable.map((c) => [c.id, c]));
    const todo = pending
      .filter((t) => !t.isInternalTransfer && t.amountInCents !== 0)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, MAX_PER_RUN);
    // Mesma descrição (sem data/código) e mesmo sinal = uma pergunta só, e a mesma categoria pra todas.
    const groups = new Map<string, Transaction[]>();
    for (const t of todo) {
      const key = `${t.amountInCents < 0 ? '-' : '+'}${patternFromDescription(t.description) || t.description}`;
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    const items = [...groups.values()];
    const cats = usable.map((c) => `${c.id}|${c.name}|${c.kind}`).join('\n');
    let categorized = 0;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      const list = batch.map((g, k) => `${k}|${g[0]!.description.replace(/\s+/g, ' ').slice(0, 90)}|${(g[0]!.amountInCents / 100).toFixed(2)}`).join('\n');
      let answer: Record<string, unknown> = {};
      try {
        const raw = await this.ai.reply([
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `CATEGORIAS (id|nome|tipo):\n${cats}\n\nTRANSAÇÕES (id|descrição|valor):\n${list}` },
        ], { temperature: 0, maxTokens: 1500, json: true });
        const parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim()) as { t?: Record<string, unknown> };
        answer = parsed.t ?? {};
      } catch {
        continue; // IA fora ou resposta estranha: fica pendente, tenta no próximo sync
      }
      for (const [k, catId] of Object.entries(answer)) {
        const group = batch[Number(k)];
        const cat = typeof catId === 'string' ? byId.get(catId) : undefined;
        if (!group || !cat) continue;
        const sign = group[0]!.amountInCents;
        if ((sign < 0 && cat.kind !== 'saida') || (sign > 0 && cat.kind !== 'entrada')) continue;
        for (const tx of group) {
          const fresh = await this.repos.transactions.findById(tx.id);
          if (!fresh || fresh.categoryId) continue; // a pessoa categorizou enquanto isso
          await this.repos.transactions.save({ ...fresh, categoryId: cat.id });
          categorized++;
        }
      }
    }
    return { categorized, asked: todo.length };
  }
}

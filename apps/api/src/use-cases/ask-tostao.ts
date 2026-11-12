import type { Repositories } from '../repositories/types.js';
import { AiUnavailableError, type AiGateway, type ChatTurn } from '../gateways/ai-gateway.js';
import { AppError } from '../domain/errors.js';
import { currentMonth } from '../lib/month.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import { ListSubscriptionsUseCase } from './list-subscriptions.js';
import { GetBudgetsUseCase } from './budgets.js';

const DAY = 24 * 60 * 60 * 1000;
const HISTORY = 12; // mensagens anteriores que vão junto (memória curta da conversa)

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const prevMonth = (m: string) => {
  const [y, mm] = m.split('-').map(Number) as [number, number];
  return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`;
};

const PERSONA = `Você é o Tostão, um porquinho de boné laranja que ajuda jovens brasileiros (18 a 25 anos) com dinheiro.
Voz: amigo sincero, sem julgamento, leve e direto. Português do Brasil, informal, sem gíria forçada.
Regras:
- Responda curto: 2 a 5 frases, ou uma lista curta. Nada de textão.
- Use SÓ os números do bloco DADOS. Se a informação não estiver lá, diga que não sabe ainda. Nunca invente valor.
- Dinheiro sempre em R$ no formato brasileiro (R$ 1.234,56). Mostre a conta quando fizer cálculo.
- Não recomende produto financeiro específico (ação, fundo, cripto, banco). Pode explicar conceitos (reserva de emergência, juros, CDI).
- Bets e "tigrinho": seja honesto que a casa sempre ganha, sem sermão.
- Se alguém pedir Pix urgente, código, senha ou "taxa pra liberar dinheiro": alerte que é golpe (o Urubu do Pix).
- Termine, quando fizer sentido, com UM próximo passo prático.
- Não use markdown pesado: no máximo **negrito** e listas com "-".`;

/** Chat com o Tostão: junta um resumo do dinheiro da pessoa e pergunta pra IA. */
export class AskTostaoUseCase {
  constructor(
    private readonly repos: Repositories,
    private readonly ai: AiGateway,
    private readonly dailyLimit = 40,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ userId, message, channel = 'app' }: { userId: string; message: string; channel?: 'app' | 'whatsapp' }) {
    const text = message.trim();
    if (!text) throw new AppError('Escreve alguma coisa pro Tostão.', 400);
    const now = this.now();
    const used = await this.repos.chat.countUserSince(userId, new Date(now.getTime() - DAY));
    if (used >= this.dailyLimit) throw new AppError(`Por hoje deu: são ${this.dailyLimit} perguntas a cada 24 h. Amanhã a gente continua!`, 429);

    const [history, data, user] = await Promise.all([
      this.repos.chat.listRecent(userId, HISTORY),
      this.snapshot(userId, now),
      this.repos.users.findById(userId),
    ]);
    const messages: ChatTurn[] = [
      { role: 'system', content: `${PERSONA}\n\nA pessoa se chama ${user?.name ?? 'você'}. Hoje é ${now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.\n\nDADOS:\n${data}` },
      ...history.map((m) => ({ role: m.role, content: m.content }) as ChatTurn),
      { role: 'user', content: text },
    ];

    let answer: string;
    try {
      answer = await this.ai.reply(messages);
    } catch (e) {
      if (e instanceof AiUnavailableError) throw new AppError('O Tostão travou pensando. Tenta de novo daqui a pouco.', 503);
      throw e;
    }
    const question = await this.repos.chat.create({ userId, role: 'user', content: text, channel });
    const reply = await this.repos.chat.create({ userId, role: 'assistant', content: answer, channel });
    return { question, reply, remainingToday: Math.max(0, this.dailyLimit - used - 1) };
  }

  /** O que a IA enxerga: números já calculados pelo app, em texto curto (barato e sem inventar). */
  private async snapshot(userId: string, now: Date) {
    const month = currentMonth(now);
    const summary = new GetMonthSummaryUseCase(this.repos);
    const [cur, prev, subs, budgets, categories, recent] = await Promise.all([
      summary.execute({ userId, month }),
      summary.execute({ userId, month: prevMonth(month) }),
      new ListSubscriptionsUseCase(this.repos, () => now).execute({ userId }),
      new GetBudgetsUseCase(this.repos).execute({ userId, month }),
      this.repos.categories.list(userId),
      this.repos.transactions.findManyInRange(userId, new Date(now.getTime() - 45 * DAY), new Date(now.getTime() + DAY)),
    ]);
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const lines: string[] = [];
    const month_ = (label: string, s: typeof cur) => {
      lines.push(`${label} (${s.month}): entrou ${brl(s.incomeInCents)}, saiu ${brl(s.outcomeInCents)}, sobrou ${brl(s.incomeInCents - s.outcomeInCents)}.`);
      if (s.byCategory.length) lines.push(`  Gastos por categoria: ${s.byCategory.slice(0, 10).map((c) => `${c.name} ${brl(c.totalInCents)}`).join('; ')}.`);
    };
    if (cur.balanceInCents !== null) lines.push(`Saldo nas contas agora: ${brl(cur.balanceInCents)} (${cur.accounts.map((a) => `${a.name} ${brl(a.balanceInCents)}`).join('; ')}).`);
    month_('Mês atual até hoje', cur);
    month_('Mês passado', prev);
    if (cur.uncategorizedCount) lines.push(`${cur.uncategorizedCount} transações deste mês estão sem categoria.`);
    const active = subs.subscriptions.filter((s) => s.active);
    if (active.length) lines.push(`Assinaturas ativas (${brl(subs.monthlyInCents)}/mês, ${brl(subs.yearlyInCents)}/ano): ${active.map((s) => `${s.name} ${brl(s.amountInCents)}${s.installmentsLeft ? ` (faltam ${s.installmentsLeft} parcelas)` : ''}`).join('; ')}.`);
    if (budgets.budgets.length) lines.push(`Limites do mês: ${budgets.budgets.map((b) => `${b.name} ${brl(b.spentInCents)} de ${brl(b.limitInCents)}`).join('; ')}.`);
    const real = recent.filter((t) => !t.isInternalTransfer).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 40);
    if (real.length) {
      lines.push('Últimas transações (data, valor, descrição, categoria):');
      for (const t of real) {
        const d = t.occurredAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
        lines.push(`  ${d} ${t.amountInCents < 0 ? '-' : '+'}${brl(Math.abs(t.amountInCents))} ${t.description} [${t.categoryId ? catName.get(t.categoryId) ?? '?' : 'sem categoria'}]`);
      }
    }
    if (lines.length <= 2 && !real.length) lines.push('Ainda não tem banco conectado nem gasto anotado.');
    return lines.join('\n');
  }
}

import { randomInt } from 'node:crypto';
import type { Repositories } from '../repositories/types.js';
import type { WhatsAppGateway } from '../gateways/whatsapp-gateway.js';
import { AppError } from '../domain/errors.js';
import type { AskTostaoUseCase } from './ask-tostao.js';
import type { CreateManualTransactionUseCase } from './create-manual-transaction.js';
import type { AutoCategorizeUseCase } from './auto-categorize.js';
import { parseExpense } from '../services/parse-expense.js';

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** Data de hoje (ou de N dias atrás) em São Paulo, ao meio-dia, igual ao "Anotar" do app. */
const spNoon = (now: Date, daysAgo: number) => {
  const ymd = new Date(now.getTime() - daysAgo * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return new Date(`${ymd}T12:00:00-03:00`);
};

const CODE_TTL = 15 * 60 * 1000;

/** "5511987654321" -> "•••• 4321" */
export const maskPhone = (phone: string) => `•••• ${phone.slice(-4)}`;

/** No WhatsApp, **negrito** do markdown vira *negrito*. */
const toWhatsApp = (text: string) => text.replace(/\*\*(.+?)\*\*/g, '*$1*');

/** Status e vínculo do número, pela tela do app. */
export class WhatsAppLinkUseCase {
  constructor(private readonly repos: Pick<Repositories, 'whatsapp'>, private readonly wa: WhatsAppGateway, private readonly now: () => Date = () => new Date()) {}

  async status({ userId }: { userId: string }) {
    const link = await this.repos.whatsapp.get(userId);
    return { enabled: this.wa.enabled, number: this.wa.displayNumber, linkedPhone: link?.phone ? maskPhone(link.phone) : null };
  }

  /** Código de 6 dígitos que a pessoa manda pro número do Tostão. Vale 15 min. */
  async createCode({ userId }: { userId: string }) {
    if (!this.wa.enabled) throw new AppError('O WhatsApp do Tostão ainda não tá ligado.', 409);
    let code = '';
    for (let i = 0; i < 5; i++) {
      code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      if (!(await this.repos.whatsapp.findByCode(code))) break;
    }
    const expiresAt = new Date(this.now().getTime() + CODE_TTL);
    await this.repos.whatsapp.setCode(userId, code, expiresAt);
    return { code, expiresAt: expiresAt.toISOString(), number: this.wa.displayNumber };
  }

  async unlink({ userId }: { userId: string }) { await this.repos.whatsapp.unlink(userId); }
}

/**
 * Mensagem que chegou no número do Tostão.
 * - Código válido: liga o número à conta.
 * - Número já ligado e "gastei 25 no ifood": anota na hora (mesmo "Anotar" do app, categoria pelas regras ou pela IA).
 * - Número já ligado, outra coisa: responde com o mesmo chat do app (mesmo contexto e mesmo limite por dia).
 * - Número desconhecido: explica como ligar. Nunca mostra dado de ninguém pra número não ligado.
 */
export class HandleWhatsAppMessageUseCase {
  private readonly seen = new Set<string>();

  constructor(
    private readonly repos: Pick<Repositories, 'whatsapp' | 'users'>,
    private readonly wa: WhatsAppGateway,
    private readonly ask: Pick<AskTostaoUseCase, 'execute'>,
    private readonly now: () => Date = () => new Date(),
    private readonly record?: {
      create: Pick<CreateManualTransactionUseCase, 'execute'>;
      categorize?: Pick<AutoCategorizeUseCase, 'execute'>;
      repos: Pick<Repositories, 'transactions' | 'categories'>;
    },
  ) {}

  /**
   * `reply` troca o jeito de responder: no n8n a resposta volta no retorno do POST, em vez de sair pelo gateway.
   */
  async execute({ id, from, text }: { id: string; from: string; text: string }, reply: (text: string) => Promise<void> = (t) => this.wa.send(from, t)) {
    // A Meta reenvia quando demora: não responder duas vezes a mesma mensagem.
    if (this.seen.has(id)) return 'duplicada';
    this.seen.add(id);
    if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value!);

    const code = /\b(\d{6})\b/.exec(text)?.[1];
    if (code) {
      const link = await this.repos.whatsapp.findByCode(code);
      if (link?.codeExpiresAt && link.codeExpiresAt > this.now()) {
        await this.repos.whatsapp.link(link.userId, from, this.now());
        const user = await this.repos.users.findById(link.userId);
        await reply(`Fechou, ${user?.name?.split(' ')[0] ?? 'tamo junto'}! 🐷 Agora é só me perguntar por aqui: "quanto gastei com delivery?", "dá pra comprar um tênis de R$ 300?". Pra desligar, é no app em Perfil > WhatsApp.`);
        return 'ligado';
      }
    }

    const link = await this.repos.whatsapp.findByPhone(from);
    if (!link) {
      await reply('Oi! Eu sou o Tostão 🐷. Pra conversar comigo aqui, abre o app em Perfil > WhatsApp, gera um código e me manda. (Se mandou um código, ele pode ter vencido: gera outro.)');
      return 'desconhecido';
    }
    const expense = this.record ? parseExpense(text) : null;
    if (expense && this.record) {
      try {
        await reply(await this.recordExpense(link.userId, expense));
      } catch (e) {
        await reply(e instanceof AppError ? e.message : 'Não consegui anotar agora. Tenta de novo daqui a pouco, ou anota no app.');
      }
      return 'anotado';
    }
    try {
      const r = await this.ask.execute({ userId: link.userId, message: text.slice(0, 1000), channel: 'whatsapp' });
      await reply(toWhatsApp(r.reply.content));
    } catch (e) {
      await reply(e instanceof AppError ? e.message : 'Travei aqui. Tenta de novo daqui a pouco.');
    }
    return 'respondido';
  }

  private async recordExpense(userId: string, e: NonNullable<ReturnType<typeof parseExpense>>) {
    const { create, categorize, repos } = this.record!;
    const { transaction } = await create.execute({ userId, description: e.description, amountInCents: e.amountInCents, kind: e.kind, occurredAt: spNoon(this.now(), e.daysAgo) });
    let categoryId = transaction.categoryId;
    if (!categoryId && categorize) {
      await categorize.execute({ userId }).catch(() => undefined);
      categoryId = (await repos.transactions.findById(transaction.id))?.categoryId ?? null;
    }
    const category = categoryId ? (await repos.categories.findById(categoryId))?.name : null;
    const when = e.daysAgo ? 'ontem' : 'hoje';
    const what = `${e.kind === 'saida' ? 'Saiu' : 'Entrou'} *${brl(e.amountInCents)}*: ${e.description}${category ? ` (${category})` : ''}, ${when}.`;
    return `Anotado! 🐷 ${what} Errou? Dá pra corrigir ou apagar no app, em Carteira.`;
  }
}

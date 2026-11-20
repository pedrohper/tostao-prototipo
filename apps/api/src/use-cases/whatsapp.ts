import { createHash, randomInt } from 'node:crypto';
import type { Repositories } from '../repositories/types.js';
import type { WhatsAppGateway } from '../gateways/whatsapp-gateway.js';
import { AppError, ConflictError } from '../domain/errors.js';
import type { KeyValueStore } from '../lib/redis.js';
import type { AskTostaoUseCase } from './ask-tostao.js';
import type { CreateManualTransactionUseCase } from './create-manual-transaction.js';
import type { AutoCategorizeUseCase } from './auto-categorize.js';
import type { PendingActionUseCase } from './pending-actions.js';
import { parseExpense } from '../services/parse-expense.js';

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** Data de hoje (ou de N dias atrás) em São Paulo, ao meio-dia, igual ao "Anotar" do app. */
const spNoon = (now: Date, daysAgo: number) => {
  const ymd = new Date(now.getTime() - daysAgo * 86_400_000).toLocaleDateString('en-CA', {
    timeZone: 'America/Sao_Paulo',
  });
  return new Date(`${ymd}T12:00:00-03:00`);
};

// Código de vínculo: "TOST-" + 12 caracteres base32 = 60 bits. Dá pra adivinhar? Não: 2^60 combinações.
// O antigo (6 dígitos, ~20 bits) caía com força bruta e dava acesso total aos dados financeiros da vítima.
const CODE_TTL = 5 * 60 * 1000;
const CODE_PREFIX = 'TOST-';
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CODE_BODY_LENGTH = 12;
/** Só começa a vincular quem manda "VINCULAR <código>" (qualquer outra mensagem com números é conversa normal). */
const LINK_MESSAGE = /^\s*VINCULAR\s+(TOST-[A-Z2-7]{12})\s*$/i;
const LINK_MAX_FAILURES = 5;
const LINK_FAILURE_WINDOW_SECONDS = 15 * 60;

/** O banco só guarda isto. Quem vazar a tabela não consegue vincular nada. */
export const hashLinkCode = (code: string) => createHash('sha256').update(code.trim().toUpperCase()).digest('hex');

export function generateLinkCode(): string {
  let body = '';
  for (let i = 0; i < CODE_BODY_LENGTH; i++) body += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return `${CODE_PREFIX}${body}`;
}

/** "5511987654321" -> "•••• 4321" */
export const maskPhone = (phone: string) => `•••• ${phone.slice(-4)}`;

/** No WhatsApp, **negrito** do markdown vira *negrito*. */
const toWhatsApp = (text: string) => text.replace(/\*\*(.+?)\*\*/g, '*$1*');

/** Status e vínculo do número, pela tela do app. */
export class WhatsAppLinkUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'whatsapp'>,
    private readonly wa: WhatsAppGateway,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async status({ userId }: { userId: string }) {
    const link = await this.repos.whatsapp.get(userId);
    return {
      enabled: this.wa.enabled,
      number: this.wa.displayNumber,
      linkedPhone: link?.phone ? maskPhone(link.phone) : null,
    };
  }

  /** Código que a pessoa manda pro número do Tostão ("VINCULAR TOST-…"). Vale 5 min; gerar outro invalida o anterior. */
  async createCode({ userId }: { userId: string }) {
    if (!this.wa.enabled) throw new AppError('O WhatsApp do Tostão ainda não tá ligado.', 409);
    const code = generateLinkCode();
    const expiresAt = new Date(this.now().getTime() + CODE_TTL);
    await this.repos.whatsapp.setCode(userId, hashLinkCode(code), expiresAt);
    return { code, expiresAt: expiresAt.toISOString(), number: this.wa.displayNumber };
  }

  async unlink({ userId }: { userId: string }) {
    await this.repos.whatsapp.unlink(userId);
  }
}

const CONFIRM_YES = /^\s*(sim|s|confirmo|confirmar|pode|ok)\s*[.!]?\s*$/i;
const CONFIRM_NO = /^\s*(n[aã]o|nao|n|cancelar|cancela)\s*[.!]?\s*$/i;

/**
 * Mensagem que chegou no número do Tostão.
 * - "VINCULAR <código>" válido: liga o número à conta (nunca troca um número que já é de alguém).
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
    private readonly kv?: KeyValueStore,
    /** "SIM"/"NÃO" confirmam ou cancelam o que a IA propôs (registrar_transacao). */
    private readonly pending?: Pick<PendingActionUseCase, 'confirm' | 'cancel' | 'hasPending'>,
  ) {}

  /**
   * `reply` troca o jeito de responder: no n8n a resposta volta no retorno do POST, em vez de sair pelo gateway.
   */
  async execute(
    { id, from, text }: { id: string; from: string; text: string },
    reply: (text: string) => Promise<void> = (t) => this.wa.send(from, t),
  ) {
    // A Meta reenvia quando demora: não responder duas vezes a mesma mensagem.
    if (this.seen.has(id)) return 'duplicada';
    this.seen.add(id);
    if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value!);

    const linkMatch = LINK_MESSAGE.exec(text);
    if (linkMatch) return this.tryLink(from, linkMatch[1]!, reply);

    const link = await this.repos.whatsapp.findByPhone(from);
    if (!link) {
      await reply(
        'Oi! Eu sou o Tostão 🐷. Pra conversar comigo aqui, abre o app em Perfil > WhatsApp, gera um código e me manda assim: VINCULAR TOST-XXXXXXXXXXXX. (O código vale 5 minutos.)',
      );
      return 'desconhecido';
    }
    // Resposta a uma proposta da IA ("Responda SIM para confirmar"): só vale se houver proposta pendente.
    if (
      this.pending &&
      (CONFIRM_YES.test(text) || CONFIRM_NO.test(text)) &&
      (await this.pending.hasPending(link.userId))
    ) {
      const yes = CONFIRM_YES.test(text);
      try {
        const r = yes
          ? await this.pending.confirm({ userId: link.userId })
          : await this.pending.cancel({ userId: link.userId });
        await reply(r.message);
      } catch (e) {
        await reply(e instanceof AppError ? e.message : 'Não consegui agora. Tenta de novo, ou anota no app.');
      }
      return yes ? 'confirmado' : 'cancelado';
    }
    const expense = this.record ? parseExpense(text) : null;
    if (expense && this.record) {
      try {
        await reply(await this.recordExpense(link.userId, expense));
      } catch (e) {
        await reply(
          e instanceof AppError
            ? e.message
            : 'Não consegui anotar agora. Tenta de novo daqui a pouco, ou anota no app.',
        );
      }
      return 'anotado';
    }
    try {
      const r = await this.ask.execute({ userId: link.userId, message: text.slice(0, 1000), channel: 'whatsapp' });
      await reply(
        r.pendingAction
          ? `${toWhatsApp(r.reply.content)}\n\nResponda *SIM* pra confirmar ou *NÃO* pra cancelar (vale 5 minutos).`
          : toWhatsApp(r.reply.content),
      );
    } catch (e) {
      if (e instanceof AppError && e.code === 'AI_CONSENT_REQUIRED') {
        await reply(
          'Pra eu usar IA, abre o app (aba Tostão) e aceita o aviso de uso de IA. Depois é só voltar aqui e perguntar. 🐷',
        );
      } else {
        await reply(e instanceof AppError ? e.message : 'Travei aqui. Tenta de novo daqui a pouco.');
      }
    }
    return 'respondido';
  }

  private async tryLink(from: string, rawCode: string, reply: (text: string) => Promise<void>) {
    const failKey = `wa:link-fail:${from}`;
    // Limite ANTES de tocar no banco: tentativa de adivinhar código não vira consulta nem pista.
    if (this.kv && Number((await this.kv.get(failKey)) ?? 0) >= LINK_MAX_FAILURES) {
      await reply('Muitas tentativas. Espera uns 15 minutos e gera um código novo no app.');
      return 'bloqueado';
    }
    // Número já ligado a uma conta: não troca nem desliga ninguém. Quem é o dono desliga pelo app.
    if (await this.repos.whatsapp.findByPhone(from)) {
      await reply(
        'Esse número já está ligado a uma conta do Tostão. Pra ligar a outra, desliga a atual antes: no app, em Perfil > WhatsApp.',
      );
      return 'ja_vinculado';
    }
    const link = await this.repos.whatsapp.findByCodeHash(hashLinkCode(rawCode));
    if (link?.codeExpiresAt && link.codeExpiresAt > this.now()) {
      try {
        await this.repos.whatsapp.link(link.userId, from, this.now());
      } catch (e) {
        // Corrida: o número foi ligado a outra conta entre a checagem e a gravação.
        if (e instanceof ConflictError || (e as { code?: string }).code === 'P2002') {
          await reply('Esse número já está ligado a uma conta do Tostão. Desliga a atual no app antes de ligar outra.');
          return 'ja_vinculado';
        }
        throw e;
      }
      await this.kv?.del(failKey);
      const user = await this.repos.users.findById(link.userId);
      await reply(
        `Fechou, ${user?.name?.split(' ')[0] ?? 'tamo junto'}! 🐷 Agora é só me perguntar por aqui: "quanto gastei com delivery?", "dá pra comprar um tênis de R$ 300?". Pra desligar, é no app em Perfil > WhatsApp.`,
      );
      return 'ligado';
    }
    await this.kv?.incr(failKey, LINK_FAILURE_WINDOW_SECONDS);
    await reply('Esse código não vale (errado ou vencido). Gera um novo no app, em Perfil > WhatsApp.');
    return 'codigo_invalido';
  }

  private async recordExpense(userId: string, e: NonNullable<ReturnType<typeof parseExpense>>) {
    const { create, categorize, repos } = this.record!;
    const { transaction } = await create.execute({
      userId,
      description: e.description,
      amountInCents: e.amountInCents,
      kind: e.kind,
      occurredAt: spNoon(this.now(), e.daysAgo),
    });
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

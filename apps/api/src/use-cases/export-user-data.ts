import type { FinancialPlan } from '@tostao/contracts';
import { ResourceNotFoundError } from '../domain/errors.js';
import type { Repositories } from '../repositories/types.js';

/** Versão do formato do arquivo. Sobe quando um campo muda de nome/forma (quem lê o JSON sabe o que esperar). */
export const EXPORT_FORMAT_VERSION = 1;

// Lançamentos futuros (parcelas, "todo mês") também são da pessoa: o intervalo vai até o fim dos tempos.
const BEGINNING = new Date(0);
const END_OF_TIME = new Date('9999-12-31T23:59:59.999Z');
// Teto de segurança pro histórico do chat (a cota diária já limita o crescimento; isto evita uma resposta sem fim).
const CHAT_LIMIT = 50_000;

export type UserDataExport = {
  exportVersion: number;
  exportedAt: string;
  legalBasis: string;
  profile: {
    id: string;
    name: string;
    email: string;
    timezone: string;
    createdAt: string;
    emailVerifiedAt: string | null;
    termsAcceptedAt: string | null;
    termsVersion: string | null;
    aiConsentAt: string | null;
    /** Chave Pix cadastrada pro "Cobrar" dos acertos (null = nenhuma). */
    pixKey: string | null;
    /** Só diz SE existe senha; o hash nunca sai. */
    hasPassword: boolean;
  };
  consents: { type: string; version: string; grantedAt: string; revokedAt: string | null }[];
  whatsapp: { phone: string; linkedAt: string | null } | null;
  accounts: {
    id: string;
    name: string;
    type: string;
    balanceInCents: number;
    currency: string;
    hidden: boolean;
    creditLimitInCents: number | null;
    dueDate: string | null;
  }[];
  categories: { id: string; name: string; emoji: string; color: string; kind: string }[];
  categoryRules: { pattern: string; categoryId: string }[];
  budgets: { categoryId: string; limitInCents: number }[];
  financialPlan: FinancialPlan | null;
  people: { id: string; name: string; createdAt: string }[];
  transactions: {
    id: string;
    accountId: string | null;
    description: string;
    customDescription: string | null;
    note: string | null;
    amountInCents: number;
    currency: string;
    occurredAt: string;
    categoryId: string | null;
    categoryName: string | null;
    isInternalTransfer: boolean;
    seriesId: string | null;
    personId: string | null;
    source: 'banco' | 'manual';
    createdAt: string;
  }[];
  lessonProgress: { lessonId: string; completedAt: string }[];
  chatMessages: { role: string; channel: string; content: string; createdAt: string }[];
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** AAAA-MM-DD no dia civil da pessoa (perto da meia-noite, o dia UTC seria o de amanhã). */
function localDay(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      now,
    );
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * "Baixar meus dados" (LGPD, art. 18, V: portabilidade). Monta um JSON com TUDO que o Tostão guarda da pessoa,
 * só dela: cada leitura filtra por `userId` (nunca por id vindo do cliente). Fora do arquivo, de propósito: hash de senha,
 * tokens de sessão/reset, código do WhatsApp e dados de outras pessoas (amigos, convites). Cada exportação gera um
 * `AuditLog` (`data_exported`) só com as contagens, nunca com o conteúdo.
 */
export class ExportUserDataUseCase {
  constructor(
    private readonly repos: Pick<
      Repositories,
      | 'users'
      | 'consents'
      | 'whatsapp'
      | 'accounts'
      | 'categories'
      | 'rules'
      | 'budgets'
      | 'plans'
      | 'people'
      | 'transactions'
      | 'lessons'
      | 'chat'
      | 'audit'
    >,
  ) {}

  async execute({
    userId,
    ipAddress,
    now = new Date(),
  }: {
    userId: string;
    ipAddress?: string | null;
    now?: Date;
  }): Promise<{ fileName: string; data: UserDataExport }> {
    const user = await this.repos.users.findById(userId);
    if (!user) throw new ResourceNotFoundError('Conta');

    const [consents, whatsapp, accounts, categories, rules, budgets, plan, people, transactions, lessons, chat] =
      await Promise.all([
        this.repos.consents.listByUser(userId),
        this.repos.whatsapp.get(userId),
        this.repos.accounts.listByUser(userId),
        this.repos.categories.list(userId),
        this.repos.rules.listForUser(userId),
        this.repos.budgets.listByUser(userId),
        this.repos.plans.get(userId),
        this.repos.people.listByUser(userId),
        this.repos.transactions.findManyInRange(userId, BEGINNING, END_OF_TIME),
        this.repos.lessons.listByUser(userId),
        this.repos.chat.listRecent(userId, CHAT_LIMIT),
      ]);

    // Segunda trava: mesmo que um repositório devolvesse linha de outra pessoa, ela não entra no arquivo.
    const mine = <T extends { userId?: string | null }>(rows: T[]) => rows.filter((r) => r.userId === userId);
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));

    const data: UserDataExport = {
      exportVersion: EXPORT_FORMAT_VERSION,
      exportedAt: now.toISOString(),
      legalBasis: 'LGPD, art. 18, inciso V (portabilidade dos dados)',
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        timezone: user.timezone,
        createdAt: user.createdAt.toISOString(),
        emailVerifiedAt: iso(user.emailVerifiedAt),
        termsAcceptedAt: iso(user.termsAcceptedAt),
        termsVersion: user.termsVersion,
        aiConsentAt: iso(user.aiConsentAt),
        pixKey: user.pixKey,
        hasPassword: user.passwordHash !== null,
      },
      consents: mine(consents)
        .sort((a, b) => a.grantedAt.getTime() - b.grantedAt.getTime())
        .map((c) => ({
          type: c.type,
          version: c.version,
          grantedAt: c.grantedAt.toISOString(),
          revokedAt: iso(c.revokedAt),
        })),
      whatsapp: whatsapp?.phone ? { phone: whatsapp.phone, linkedAt: iso(whatsapp.linkedAt) } : null,
      accounts: mine(accounts).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balanceInCents: a.balanceInCents,
        currency: a.currency ?? 'BRL',
        hidden: a.hidden,
        creditLimitInCents: a.creditLimitInCents,
        dueDate: iso(a.dueDate),
      })),
      // Só as categorias CRIADAS pela pessoa (as do sistema são iguais pra todo mundo; o lançamento guarda o id e o nome).
      categories: categories
        .filter((c) => c.userId === userId)
        .map((c) => ({ id: c.id, name: c.name, emoji: c.emoji, color: c.color, kind: c.kind })),
      categoryRules: mine(rules).map((r) => ({ pattern: r.pattern, categoryId: r.categoryId })),
      budgets: mine(budgets).map((b) => ({ categoryId: b.categoryId, limitInCents: b.limitInCents })),
      financialPlan: plan,
      people: mine(people).map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt.toISOString() })),
      transactions: mine(transactions)
        .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
        .map((t) => ({
          id: t.id,
          accountId: t.accountId,
          description: t.description,
          customDescription: t.customDescription ?? null,
          note: t.note ?? null,
          amountInCents: t.amountInCents,
          currency: t.currency ?? 'BRL',
          occurredAt: t.occurredAt.toISOString(),
          categoryId: t.categoryId,
          categoryName: t.categoryId ? (categoryName.get(t.categoryId) ?? null) : null,
          isInternalTransfer: t.isInternalTransfer,
          seriesId: t.seriesId ?? null,
          personId: t.personId ?? null,
          source: t.accountId ? 'banco' : 'manual',
          createdAt: t.createdAt.toISOString(),
        })),
      lessonProgress: mine(lessons).map((l) => ({ lessonId: l.lessonId, completedAt: l.completedAt.toISOString() })),
      chatMessages: mine(chat)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((m) => ({ role: m.role, channel: m.channel, content: m.content, createdAt: m.createdAt.toISOString() })),
    };

    // Trilha de auditoria: quem baixou, quando e quanto (contagens, nunca o conteúdo).
    await this.repos.audit.record({
      userId,
      action: 'data_exported',
      entityType: 'user',
      entityId: userId,
      ipAddress: ipAddress ?? null,
      metadata: {
        formatVersion: EXPORT_FORMAT_VERSION,
        transactions: data.transactions.length,
        accounts: data.accounts.length,
        chatMessages: data.chatMessages.length,
      },
    });

    return { fileName: `tostao-meus-dados-${localDay(now, user.timezone)}.json`, data };
  }
}

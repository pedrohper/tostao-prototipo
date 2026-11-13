// Contratos compartilhados entre a API e a web.
// Tudo que atravessa a rede passa por aqui: o schema Zod valida na API
// e o tipo inferido (z.infer) tipa a web. Um lugar só pra mudar.
import { z } from 'zod';
export * from './juros';

// ---------- Auth ----------
export const registerBody = z.object({
  name: z.string().trim().min(2, 'Nome muito curto'),
  email: z.email('E-mail inválido').transform((e) => e.toLowerCase()),
  password: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres'),
  inviteCode: z.string().trim().max(40).optional(),
});
export type RegisterBody = z.infer<typeof registerBody>;

export const loginBody = z.object({
  email: z.email('E-mail inválido').transform((e) => e.toLowerCase()),
  password: z.string().min(1, 'Digite a senha'),
});
export type LoginBody = z.infer<typeof loginBody>;

export type AuthResponse = { token: string };

export const resetPasswordBody = z.object({
  token: z.string().min(20),
  password: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres'),
});

// Apagar a conta: confirma com a senha.
export const deleteAccountBody = z.object({
  password: z.string().min(1, 'Digite sua senha pra confirmar'),
});

export type InviteDTO = { code: string; createdAt: string; usedAt: string | null; usedBy: string | null };
export type InvitesResponse = { invites: InviteDTO[] };

export type ProfileResponse = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  connections: {
    id: string; itemId: string; institution: string | null;
    /** Nome pra mostrar: o banco de verdade, mesmo quando a conexão vem pelo MeuPluggy. */
    displayName: string;
    lastSyncedAt: string | null; status: string;
    accounts: { id: string; name: string; type: 'BANK' | 'CREDIT'; balanceInCents: number; hidden: boolean }[];
  }[];
};

// ---------- Banco ----------
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export const connectBankBody = z.object({
  // Item IDs do Pluggy são UUIDs. Se a pessoa colar um link ou texto com um UUID dentro, a gente pesca ele.
  itemId: z
    .string()
    .trim()
    .transform((v) => v.match(UUID)?.[0].toLowerCase() ?? v)
    .pipe(z.string().min(8, 'Item ID parece curto demais')),
});
export type ConnectBankBody = z.infer<typeof connectBankBody>;

export type SyncResponse = { importedCount: number; accounts: number };

/** providerDeleted = false quando o Pluggy não confirmou: aí vale revogar no meu.pluggy.ai. */
export type DisconnectResponse = { providerDeleted: boolean };

/** null quando a API roda com o banco de exemplo (sem widget). */
export type ConnectTokenResponse = { connectToken: string | null };

// ---------- Transações ----------
export const monthQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Use AAAA-MM'),
});

/** Busca na Carteira: texto livre (loja, pessoa, categoria, banco) + filtros. */
export const searchQuery = z.object({
  q: z.string().trim().max(80).default(''),
  period: z.enum(['30d', '3m', '12m', 'tudo']).default('12m'),
  kind: z.enum(['todas', 'saida', 'entrada']).default('todas'),
  categoryId: z.string().optional(),
});
export type SearchQuery = z.infer<typeof searchQuery>;

export const manualTransactionBody = z.object({
  description: z.string().trim().min(1, 'Diz o que foi'),
  amountInCents: z.number().int().positive('Valor precisa ser maior que zero'),
  kind: z.enum(['saida', 'entrada']),
  occurredAt: z.iso.date(),
  categoryId: z.string().nullable().optional(),
  /** "Pago com": null = dinheiro vivo. */
  accountId: z.string().nullable().optional(),
  /** nao = só esse; mensal = repete todo mês (12 meses lançados); parcelado = o valor é o total, dividido em `times` meses. */
  repeat: z.enum(['nao', 'mensal', 'parcelado']).default('nao'),
  times: z.number().int().min(2, 'Parcela em pelo menos 2x').max(48, 'No máximo 48x').optional(),
}).refine((b) => b.repeat !== 'parcelado' || (b.times ?? 0) >= 2, { message: 'Diz em quantas vezes', path: ['times'] });
export type ManualTransactionBody = z.infer<typeof manualTransactionBody>;

export const categorizeBody = z.object({
  categoryId: z.string().min(1),
  // Se true, cria uma regra: próximas transações com a mesma descrição caem nessa categoria
  remember: z.boolean().default(false),
});
export type CategorizeBody = z.infer<typeof categorizeBody>;

export type TransactionDTO = {
  id: string;
  description: string;
  amountInCents: number;
  occurredAt: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryEmoji: string | null;
  categoryColor: string | null;
  accountName: string | null;
  isInternalTransfer: boolean;
  source: 'bank' | 'manual';
  /** Faz parte de um "todo mês" ou "parcelado" anotado à mão. */
  seriesId: string | null;
  /** Acerto com alguém (empréstimo, cartão emprestado): fora do gasto e da renda. */
  personId: string | null;
};

// ---------- Acertos (quem te deve / pra quem você deve) ----------
/** saldo > 0: a pessoa te deve. saldo < 0: você deve pra ela. */
export type PersonDTO = { id: string; name: string; balanceInCents: number; count: number; lastAt: string | null };
export type PeopleResponse = { people: PersonDTO[]; owedToYouInCents: number; youOweInCents: number };
export type PersonDetailResponse = { person: PersonDTO; transactions: TransactionDTO[] };
/** Liga o lançamento a uma pessoa pelo nome (cria se não existir). null desfaz. */
export const createPersonBody = z.object({ name: z.string().trim().min(1, 'Diz o nome').max(40, 'Nome curto, até 40 letras') });
export const linkPersonBody = z.object({ personName: z.string().trim().min(1, 'Diz o nome').max(40, 'Nome curto, até 40 letras').nullable() });
/** Acerto anotado à mão (dinheiro vivo, combinado de boca). */
export const personEntryBody = z.object({
  kind: z.enum(['emprestei', 'peguei', 'recebi', 'paguei']),
  amountInCents: z.number().int().positive('Valor precisa ser maior que zero').max(100_000_000),
  description: z.string().trim().max(80).optional(),
  occurredAt: z.iso.date(),
});
export type PersonEntryBody = z.infer<typeof personEntryBody>;

export type SearchResponse = {
  transactions: TransactionDTO[];
  /** Total achado (a lista vem cortada em 200). */
  count: number;
  outInCents: number;
  inInCents: number;
};

/** kind "neutra" = "Não conta" (some do gasto e da renda). custom = criada pela pessoa. */
export type CategoryDTO = { id: string; name: string; emoji: string; color: string; kind: 'saida' | 'entrada' | 'neutra'; custom: boolean };

export const createCategoryBody = z.object({
  name: z.string().trim().min(2, 'Nome curto demais').max(30, 'Nome longo demais'),
  emoji: z.string().trim().max(16).default('🏷️'),
  kind: z.enum(['saida', 'entrada']),
});
export type CreateCategoryBody = z.infer<typeof createCategoryBody>;

export type MonthSummaryResponse = {
  month: string;
  balanceInCents: number | null; // null quando não tem banco conectado
  incomeInCents: number;
  outcomeInCents: number;
  uncategorizedCount: number;
  byCategory: { categoryId: string | null; name: string; color: string; totalInCents: number }[];
  /** BANK = conta corrente (entra no saldo); CREDIT = cartão (balance = fatura em aberto). */
  accounts: { id: string; name: string; type: 'BANK' | 'CREDIT'; balanceInCents: number; creditLimitInCents: number | null; dueDate: string | null; brand: string | null; last4: string | null }[];
  /** Contas que a pessoa ocultou: fora do saldo e da lista. */
  hiddenAccounts: { id: string; name: string; balanceInCents: number }[];
};

export type TransactionDetailResponse = { transaction: TransactionDTO; rulePattern: string };

/** Logo oficial de cada banco (GET /institutions/logos). */
export type InstitutionLogosResponse = { logos: { name: string; imageUrl: string; color: string | null }[] };

/** Detalhe de uma conta ou cartão num mês (GET /accounts/:id?month=). */
export type AccountDetailResponse = {
  account: {
    id: string; name: string; type: 'BANK' | 'CREDIT'; institution: string | null;
    /** Cartão: negativo = fatura em aberto. */
    balanceInCents: number; creditLimitInCents: number | null; dueDate: string | null;
    lastSyncedAt: string | null; hidden: boolean;
    /** Cartão: bandeira (VISA, MASTERCARD, ELO...) e final, quando o banco manda. */
    brand: string | null; last4: string | null;
  };
  month: string;
  outInCents: number;
  inInCents: number;
  byCategory: { categoryId: string | null; name: string; color: string; totalInCents: number }[];
  /** Últimos 6 meses até o mês pedido (sem transferência interna). */
  history: { month: string; outInCents: number; inInCents: number }[];
  transactions: TransactionDTO[];
  /** Cartão: compras parceladas que ainda têm parcela pra cair. */
  installments: { description: string; amountInCents: number; n: number; total: number; left: number }[];
  /** Cartão: parcelas já contratadas nos próximos 3 meses. */
  upcoming: { month: string; amountInCents: number }[];
};

// ---------- Assinaturas ----------
export type SubscriptionDTO = {
  key: string;
  name: string;
  amountInCents: number; // positivo: quanto custa por mês
  chargeCount: number;
  lastChargedAt: string;
  nextChargeAt: string;
  active: boolean; // false = não cobrou no último ciclo
  installmentsLeft: number | null; // plano parcelado: quantas parcelas faltam
  /** Mesmo serviço cobrando mais de uma vez (ex.: dois Prime): nome da outra cobrança. */
  duplicateOf: string | null;
};
export type SubscriptionsResponse = { subscriptions: SubscriptionDTO[]; ignored: SubscriptionDTO[]; monthlyInCents: number; yearlyInCents: number };
export const ignoreSubscriptionBody = z.object({ key: z.string().min(1).max(200), ignored: z.boolean() });

// ---------- Limites por categoria ----------
export const setBudgetBody = z.object({
  // null tira o limite
  limitInCents: z.number().int().positive('O limite precisa ser maior que zero').max(100_000_000).nullable(),
});
export type SetBudgetBody = z.infer<typeof setBudgetBody>;
export type BudgetDTO = { categoryId: string; name: string; emoji: string; color: string; limitInCents: number; spentInCents: number };
export type BudgetsResponse = { budgets: BudgetDTO[] };

// ---------- Progresso das lições ----------
export const lessonIdParam = z.object({ lessonId: z.string().regex(/^m\d+-l\d+$/, 'Lição inválida') });
/** streakDays = ofensiva (dias seguidos com lição); doneToday = lições feitas hoje (Brasília). */
export type LessonProgressResponse = { done: string[]; streakDays: number; doneToday: number; bonusXp: number };

// Jogos: Tribunal do Tostão e Batalhas
export const tribunalVoteBody = z.object({ caseId: z.string().min(1), choice: z.number().int().min(0).max(3) });
export type TribunalResponse = {
  case: { id: string; title: string; story: string; question: string; options: string[] };
  endsAt: string;
  totalVotes: number;
  myVote: number | null;
  votes: number[] | null;
  verdict: { title: string; text: string } | null;
};
export const urubuStepBody = z.object({ done: z.boolean() });
export type BattlesResponse = {
  checksStatement: boolean;
  tigrinho: { status: 'ativa' | 'vencida' | 'perdida'; startedAt: string; day: number; totalDays: number; lostAt: string | null } | null;
  urubu: { status: 'bloqueada' | 'ativa' | 'vencida'; steps: { id: string; label: string; done: boolean }[] };
};

// Chat com o Tostão
export const chatBody = z.object({ message: z.string().trim().min(1, 'Escreve alguma coisa').max(1000, 'Pergunta longa demais') });
export type ChatMessageDTO = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };
export type ChatHistoryResponse = { messages: ChatMessageDTO[] };
export type ChatReplyResponse = { question: ChatMessageDTO; reply: ChatMessageDTO; remainingToday: number };

// Importar extrato (OFX/CSV)
export const importStatementBody = z.object({
  accountName: z.string().trim().max(40).default(''),
  fileName: z.string().max(200),
  content: z.string().min(10, 'Arquivo vazio').max(4_000_000, 'Arquivo grande demais (máx. 4 MB)'),
  isCard: z.boolean().optional(),
});
export type ImportResponse = { importedCount: number; skipped: number; format: 'ofx' | 'csv'; kind: 'BANK' | 'CREDIT'; accountName: string; from: string; to: string };

// ---------- Renda, contas fixas e previsão ----------
const cents = z.number().int().min(0).max(100_000_000);
const day = z.number().int().min(1).max(31);
/** A meta (uma só por pessoa). savedInCents = quanto já guardou; o app soma com "Guardei". */
export const goalBody = z.object({
  kind: z.enum(['reserva', 'viagem', 'sair-do-vermelho', 'outro']),
  label: z.string().trim().max(60).nullable().default(null),
  amountInCents: cents.nullable().default(null),
  deadline: z.string().regex(/^\d{4}-\d{2}$/).nullable().default(null),
  savedInCents: cents.optional(),
});
export type Goal = z.infer<typeof goalBody>;
/** "Guardei R$ 50" (positivo) ou "tirei R$ 20" (negativo). */
export const goalDepositBody = z.object({ amountInCents: z.number().int().min(-100_000_000).max(100_000_000).refine((v) => v !== 0, 'Valor precisa ser diferente de zero') });

export const financialPlanBody = z.object({
  salary: z.object({
    amountInCents: cents,
    payday: day,
    varies: z.boolean().default(false),
    bank: z.string().trim().max(60).nullable().default(null),
    /** Adiantamento: parte do salário que cai antes, ex.: metade no dia 15. amountInCents é o total do mês. */
    advance: z.object({ day, amountInCents: cents }).nullable().default(null),
    /** Padrão da descrição no extrato (ex.: "TRANSF SALDO C/SAL P/CC"). */
    pattern: z.string().trim().max(120).nullable().default(null),
  }).nullable(),
  otherIncomes: z.array(z.object({
    name: z.string().trim().min(1).max(60),
    amountInCents: cents,
    day: day.nullable().default(null),
    countsAsIncome: z.boolean(),
    pattern: z.string().trim().max(120).nullable().default(null),
  })).max(10).default([]),
  fixedExpenses: z.array(z.object({ name: z.string().trim().min(1).max(60), amountInCents: cents, day })).max(20).default([]),
  /** VR e VA: não passam pelo Open Finance, a pessoa informa. Só servem pra comida, não entram no caixa. */
  benefits: z.array(z.object({ kind: z.enum(['VR', 'VA', 'outro']), amountInCents: cents, day })).max(4).default([]),
  goal: goalBody.nullable().default(null),
});
export type FinancialPlan = z.infer<typeof financialPlanBody>;
export type FinancialPlanResponse = { plan: FinancialPlan | null };

/** Entradas que se repetem no extrato, pra pessoa dizer o que é salário e o que é repasse. */
export type IncomeSuggestion = {
  pattern: string;
  sample: string;
  bank: string | null;
  monthlyAvgInCents: number;
  months: number;
  hits: { date: string; amountInCents: number }[];
  countsAsIncome: boolean;
};
export type IncomeSuggestionsResponse = { suggestions: IncomeSuggestion[] };

export type ForecastMonth = {
  month: string;
  incomeInCents: number;
  fixedInCents: number;
  subscriptionsInCents: number;
  installmentsInCents: number;
  dailyInCents: number;
  leftInCents: number;
  /** VR/VA do mês: informativo, não entra no leftInCents. */
  benefitsInCents: number;
  /** Lançamentos anotados que já estão marcados pra esse mês (todo mês / parcelas). */
  scheduledOutInCents: number;
  scheduledInInCents: number;
  /** O que cai de verdade no mês, item por item (o dia a dia fica de fora: é estimativa). */
  items: ForecastItem[];
  /** Fatura prevista de cada cartão: parcelas + assinaturas + o que foi anotado nele. */
  cards: { id: string; name: string; dueDay: number | null; totalInCents: number }[];
};
export type ForecastItem = {
  kind: 'renda' | 'conta' | 'assinatura' | 'parcela' | 'anotado';
  title: string;
  /** Sempre positivo; `entrada` diz o sentido. */
  amountInCents: number;
  entrada: boolean;
  day: number | null;
  /** Cai na fatura desse cartão (null = sai da conta). */
  cardId: string | null;
  /** Parcela: "4/10". */
  detail: string | null;
};
/** Situação da meta: quanto falta e quanto guardar por mês pra chegar no prazo. */
export type GoalStatus = {
  label: string;
  amountInCents: number | null;
  savedInCents: number;
  deadline: string | null;
  monthsLeft: number | null;
  /** null = sem valor ou sem prazo. */
  monthlyNeededInCents: number | null;
  /** O que sobra no mês que vem dá pra guardar o mensal da meta? null = sem previsão. */
  fits: boolean | null;
  reached: boolean;
};
/** O mês que está rolando: quanto ainda deve sobrar até o último dia. */
export type ThisMonthForecast = {
  month: string;
  daysLeft: number;
  incomeInCents: number;
  spentInCents: number;
  fixedLeftInCents: number;
  subscriptionsLeftInCents: number;
  dailyLeftInCents: number;
  /** Ritmo do dia a dia por dia usado no resto do mês (sem assinaturas e contas grandes). */
  dailyPaceInCents?: number;
  leftInCents: number;
};
/** Um mês do passado visto pela previsão: quanto saiu, quanto veio de dinheiro extra e quanto conta como dia a dia normal. */
export type SpendingBaseMonth = {
  month: string;
  incomeInCents: number;
  outcomeInCents: number;
  /** Entrada bem acima da renda normal (acerto, 13º, restituição...). */
  extraIncomeInCents: number;
  /** Parte do gasto que passou da renda e foi paga com dinheiro extra: sai da base. */
  paidWithExtraInCents: number;
  /** O que fica pra base do dia a dia. */
  baseInCents: number;
};
/**
 * De onde vem o "dia a dia" da previsão.
 * ok = gasto dentro da renda; excecao = gastou mais, mas com dinheiro extra (acerto etc.);
 * aperto = gastou mais que a renda em 2+ dos últimos 3 meses sem dinheiro extra pra cobrir.
 */
export type SpendingBase = {
  normalIncomeInCents: number;
  /** Mediana da base dos últimos 3 meses com gasto. */
  typicalInCents: number;
  status: 'ok' | 'excecao' | 'aperto';
  months: SpendingBaseMonth[];
};
export type ForecastResponse = { hasPlan: boolean; months: ForecastMonth[]; goal: GoalStatus | null; thisMonth: ThisMonthForecast | null; base?: SpendingBase | null };
/** Quantas pendentes a IA categorizou (das que ela olhou). */
export type AutoCategorizeResponse = { categorized: number; asked: number };

// ---------- Missões, ofensiva, amigos, avisos e resumo da semana ----------
/** O que conta como missão feita. "visita:*" vem das telas que a missão do dia manda abrir. */
export const ACTIVITY_KINDS = ['licao', 'categorizar', 'anotar', 'tribunal', 'batalha', 'meta', 'limites', 'assinaturas', 'chat',
  'visita:previsao', 'visita:assinaturas', 'visita:limites', 'visita:fechamento'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export const activityBody = z.object({ kind: z.enum(ACTIVITY_KINDS) });

export type MissionDTO = { id: string; title: string; href: string; done: boolean };
export type MissionsResponse = {
  missions: MissionDTO[];
  streakDays: number;
  /** Hoje já tem alguma missão feita? (a ofensiva de hoje está garantida) */
  todayKept: boolean;
  /** Dias da semana (seg a dom) com pelo menos uma missão. */
  week: { day: string; done: number }[];
};

export type FriendDTO = { id: string; name: string; streakDays: number; weekScore: number; me: boolean };
export type FriendsResponse = { code: string; challenge: { title: string; endsAt: string }; ranking: FriendDTO[] };
export const addFriendBody = z.object({ code: z.string().trim().min(4).max(20) });

export type ReminderDTO = { key: string; kind: 'fatura' | 'conta' | 'assinatura'; title: string; amountInCents: number | null; dueDate: string; daysLeft: number };
export type RemindersResponse = { reminders: ReminderDTO[] };

export type WeeklyResponse = {
  from: string;
  to: string;
  spentInCents: number;
  prevSpentInCents: number;
  top: { categoryId: string | null; name: string; totalInCents: number } | null;
  missionsDone: number;
  streakDays: number;
};

export const pushSubscriptionBody = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
export const pushUnsubscribeBody = z.object({ endpoint: z.string().url().max(1000) });
export type PushKeyResponse = { publicKey: string | null; subscribed: number };

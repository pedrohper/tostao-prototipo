// Contratos compartilhados entre a API e a web.
// Tudo que atravessa a rede passa por aqui: o schema Zod valida na API
// e o tipo inferido (z.infer) tipa a web. Um lugar só pra mudar.
import { z } from 'zod';
export * from './juros';

// ---------- Auth ----------
// bcrypt só lê os 72 primeiros BYTES da senha (o resto seria ignorado em silêncio). Rejeitamos acima disso.
export const MAX_PASSWORD_BYTES = 72;
const passwordMax = (schema: z.ZodString) =>
  schema
    .max(MAX_PASSWORD_BYTES, 'A senha pode ter no máximo 72 caracteres')
    .refine((v) => new TextEncoder().encode(v).length <= MAX_PASSWORD_BYTES, 'A senha pode ter no máximo 72 bytes');

export const registerBody = z.object({
  name: z.string().trim().min(2, 'Nome muito curto'),
  email: z.email('E-mail inválido').transform((e) => e.toLowerCase()),
  password: passwordMax(z.string().min(8, 'A senha precisa de pelo menos 8 caracteres')),
  inviteCode: z.string().trim().max(40).optional(),
  // Aceite dos Termos e da Privacidade: o checkbox da web não basta, o servidor exige.
  acceptedTerms: z.literal(true, { error: 'Aceite os Termos e a Política de Privacidade pra criar a conta' }),
});
export type RegisterBody = z.infer<typeof registerBody>;

export const loginBody = z.object({
  email: z.email('E-mail inválido').transform((e) => e.toLowerCase()),
  password: passwordMax(z.string().min(1, 'Digite a senha')),
});
export type LoginBody = z.infer<typeof loginBody>;

/** Sessão: access token (JWT, 15 min) + refresh token opaco (30 dias, rotativo e revogável). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export type AuthResponse = { accessToken: string; refreshToken: string };

export const refreshBody = z.object({ refreshToken: z.string().min(20).max(256) });
export type RefreshBody = z.infer<typeof refreshBody>;

export const oauthProviderSchema = z.enum(['google', 'apple']);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

export type OAuthProvidersResponse = { google: boolean; apple: boolean };

// "state" tem 256 bits em base64url (43 chars). Quem gera é a API; a web só repassa.
export const OAUTH_STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const oauthFromSchema = z.enum(['entrar', 'criar-conta']);

// O nonce e o code_verifier (PKCE) nascem e ficam SÓ no servidor, ligados ao state. O navegador nunca os vê.
export const oauthStartBody = z.object({
  provider: oauthProviderSchema,
  redirectUri: z.string().url('redirectUri inválida').max(500),
  inviteCode: z.string().trim().max(32).optional(),
  from: oauthFromSchema.optional(),
});
export type OAuthStartBody = z.infer<typeof oauthStartBody>;
/** state: a web guarda num cookie assinado pra amarrar o retorno ao mesmo navegador. */
export type OAuthStartResponse = { url: string; state: string };

export const oauthCallbackBody = z.object({
  provider: oauthProviderSchema,
  code: z.string().min(1, 'Código de autorização ausente').max(2048),
  state: z.string().regex(OAUTH_STATE_PATTERN, 'state inválido'),
  redirectUri: z.string().url('redirectUri inválida').max(500),
  name: z.string().trim().max(120).optional(),
});
export type OAuthCallbackBody = z.infer<typeof oauthCallbackBody>;
export type OAuthAuthResponse = AuthResponse & { isNewUser: boolean };

export const resetPasswordBody = z.object({
  token: z.string().min(20).max(256),
  password: passwordMax(z.string().min(8, 'A senha precisa de pelo menos 8 caracteres')),
});

// "Esqueci minha senha": a resposta é sempre a mesma (202), exista a conta ou não.
export const passwordResetRequestBody = z.object({
  email: z.email('E-mail inválido').transform((e) => e.toLowerCase()),
});
export type PasswordResetRequestBody = z.infer<typeof passwordResetRequestBody>;
export const PASSWORD_RESET_REQUEST_MESSAGE =
  'Se esse e-mail tiver conta no Tostão, você vai receber um link pra criar uma senha nova. Vale por 1 hora.';
export type PasswordResetRequestResponse = { message: string };

// Verificação de e-mail (link do cadastro, 24 h).
export const verifyEmailBody = z.object({ token: z.string().min(20).max(256) });
export type VerifyEmailBody = z.infer<typeof verifyEmailBody>;

// Apagar a conta: confirma com a senha (ou com o e-mail, se a conta entrou só com Google/Apple).
/** providerFailures > 0: não deu pra desligar algum banco no Open Finance; a pessoa deve revogar por lá. */
export type DeleteAccountResponse = { deleted: true; providerFailures: number };

export const deleteAccountBody = z
  .object({
    password: z.string().optional(),
    confirmEmail: z.string().trim().optional(),
  })
  .refine((v) => Boolean(v.password?.length) || Boolean(v.confirmEmail?.length), {
    message: 'Confirme sua senha ou seu e-mail pra apagar a conta',
  });

export type InviteDTO = { code: string; createdAt: string; usedAt: string | null; usedBy: string | null };
export type InvitesResponse = { invites: InviteDTO[] };

export type ProfileResponse = {
  id: string;
  name: string;
  email: string;
  hasPassword: boolean;
  /** O servidor tem o widget Pluggy Connect? false = só o campo manual. O connect-token só é pedido no clique. */
  pluggyEnabled: boolean;
  providers: OAuthProvider[];
  createdAt: string;
  /** Quando aceitou o aviso de uso de IA (LGPD). null = IA bloqueada até aceitar. */
  aiConsentAt: string | null;
  /** Quando provou que controla o e-mail. null = ainda não verificou. */
  emailVerifiedAt: string | null;
  connections: {
    id: string;
    /** Derivados do itemId no servidor: o ID bruto do provedor nunca sai da API. */
    isImport: boolean;
    isManual: boolean;
    institution: string | null;
    /** Nome pra mostrar: o banco de verdade, mesmo quando a conexão vem pelo MeuPluggy. */
    displayName: string;
    lastSyncedAt: string | null;
    status: string;
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
    .pipe(
      z
        .string()
        .min(8, 'Item ID parece curto demais')
        .max(128, 'Item ID longo demais')
        // Esses prefixos são das conexões internas (extrato importado / conta manual) e o itemId vai pra URL do Pluggy.
        .refine((v) => !/^(import|manual):/i.test(v) && !/[/\\?#]|\.\./.test(v), 'Item ID inválido'),
    ),
});
export type ConnectBankBody = z.infer<typeof connectBankBody>;

export type SyncResponse = { importedCount: number; accounts: number };

/** providerDeleted = false quando o Pluggy não confirmou: aí vale revogar no meu.pluggy.ai. */
export type DisconnectResponse = { providerDeleted: boolean };

/** null quando a API roda com o banco de exemplo (sem widget). */
export type ConnectTokenResponse = { connectToken: string | null };

// ---------- Limites compartilhados ----------
/** Teto de qualquer valor em centavos que entra pela API: R$ 100 milhões. Cabe com folga em Number.MAX_SAFE_INTEGER (o banco é BIGINT). */
export const MAX_CENTS = 10_000_000_000;
/** Mês no formato AAAA-MM com mês de verdade (01..12): "2026-13" e "2026-00" não passam. */
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Id de recurso nas rotas (`:id`): UUID. Lixo vira 400 na borda, nunca chega no banco. */
export const idParam = z.object({ id: z.uuid('Id inválido') });
const centsMoney = z.number().int().min(-MAX_CENTS).max(MAX_CENTS);
const shortId = z.string().min(1).max(64);

// ---------- Transações ----------
export const monthQuery = z.object({
  month: z.string().regex(MONTH_PATTERN, 'Use AAAA-MM (mês de 01 a 12)'),
});

/** Busca na Carteira: texto livre (loja, pessoa, categoria, banco) + filtros. */
export const SEARCH_DEFAULT_LIMIT = 50;
export const SEARCH_MAX_LIMIT = 200;

export const searchQuery = z.object({
  q: z.string().trim().max(80).default(''),
  period: z.enum(['30d', '3m', '12m', 'tudo']).default('12m'),
  kind: z.enum(['todas', 'saida', 'entrada']).default('todas'),
  categoryId: z.string().optional(),
  excludeTransfers: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional(),
  excludeYields: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional(),
  /** Quantos lançamentos por página (a lista é paginada no banco; `nextCursor` traz a próxima). */
  limit: z.coerce.number().int().min(1).max(SEARCH_MAX_LIMIT).default(SEARCH_DEFAULT_LIMIT),
  /** `nextCursor` da página anterior (opaco: a web só devolve). Sem ele, é a primeira página. */
  cursor: z.string().min(1).max(200).optional(),
});
export type SearchQuery = z.infer<typeof searchQuery>;

/** Identifica rendimentos automáticos de conta/CDB/dividendos (sem confundir com Banco Rendimento). */
export function isYieldTransaction(tx: { description: string; amountInCents: number }): boolean {
  if (tx.amountInCents <= 0) return false;
  const text = tx.description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || /\bbanco rendimento\b/.test(text)) return false;
  return /\brendimentos?\b|\bdividendos?\b|\bjuros sobre capital\b|\bjcp\b|\bremuneracao\b/.test(text);
}

/** Tamanho máximo da anotação de uma transação. */
export const NOTE_MAX = 280;

export const manualTransactionBody = z
  .object({
    description: z.string().trim().min(1, 'Diz o que foi').max(140, 'Descrição longa demais'),
    amountInCents: z.number().int().positive('Valor precisa ser maior que zero').max(MAX_CENTS, 'Valor alto demais'),
    kind: z.enum(['saida', 'entrada']),
    occurredAt: z.iso.date(),
    categoryId: shortId.nullable().optional(),
    /** "Pago com": null = dinheiro vivo. */
    accountId: shortId.nullable().optional(),
    /** nao = só esse; mensal = repete todo mês (12 meses lançados); parcelado = o valor é o total, dividido em `times` meses. */
    repeat: z.enum(['nao', 'mensal', 'parcelado']).default('nao'),
    times: z.number().int().min(2, 'Parcela em pelo menos 2x').max(48, 'No máximo 48x').optional(),
    note: z.string().trim().max(NOTE_MAX, `Anotação até ${NOTE_MAX} caracteres`).optional(),
  })
  .refine((b) => b.repeat !== 'parcelado' || (b.times ?? 0) >= 2, { message: 'Diz em quantas vezes', path: ['times'] });
export type ManualTransactionBody = z.infer<typeof manualTransactionBody>;

export const categorizeBody = z.object({
  categoryId: shortId,
  // Se true, cria uma regra: próximas transações com a mesma descrição caem nessa categoria
  remember: z.boolean().default(false),
});
export type CategorizeBody = z.infer<typeof categorizeBody>;

export const updateTransactionBody = z.object({
  isInternalTransfer: z.boolean().optional(),
  description: z.string().trim().min(1, 'Diz o que foi').max(140, 'Descrição longa demais').optional(),
  amountInCents: centsMoney.refine((n) => n !== 0, 'Valor precisa ser diferente de zero').optional(),
  occurredAt: z.iso.date().optional(),
  /** Texto vazio ou null apaga a anotação. Pode ser editada também em transação do banco. */
  note: z.string().trim().max(NOTE_MAX, `Anotação até ${NOTE_MAX} caracteres`).nullable().optional(),
});
export type UpdateTransactionBody = z.infer<typeof updateTransactionBody>;

export const createManualAccountBody = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(40, 'Nome muito longo'),
  type: z.enum(['BANK', 'CREDIT']),
  balanceInCents: centsMoney.default(0),
});
export type CreateManualAccountBody = z.infer<typeof createManualAccountBody>;

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
  /** Anotação livre da pessoa sobre o lançamento. */
  note: string | null;
};

// ---------- Anotações ----------
/** Anotação à mão que o app apagou sozinho porque o banco confirmou a cobrança. */
export type ConfirmedNoteDTO = {
  id: string;
  description: string;
  amountInCents: number;
  /** Data em que a pessoa tinha anotado. */
  occurredAt: string;
  note: string | null;
  categoryName: string | null;
  categoryEmoji: string | null;
  /** Cobrança do banco que a substituiu. */
  bankTransactionId: string | null;
  bankDescription: string;
  reconciledAt: string;
};
export type NotesResponse = {
  /** Tudo que foi anotado à mão e continua valendo. */
  entries: TransactionDTO[];
  /** O que o app apagou sozinho (histórico). */
  confirmed: ConfirmedNoteDTO[];
};

// ---------- Acertos (quem te deve / pra quem você deve) ----------
/** saldo > 0: a pessoa te deve. saldo < 0: você deve pra ela. */
export type PersonDTO = { id: string; name: string; balanceInCents: number; count: number; lastAt: string | null };
export type PeopleResponse = { people: PersonDTO[]; owedToYouInCents: number; youOweInCents: number };
export type PersonDetailResponse = { person: PersonDTO; transactions: TransactionDTO[] };
/** Liga o lançamento a uma pessoa pelo nome (cria se não existir). null desfaz. */
export const createPersonBody = z.object({
  name: z.string().trim().min(1, 'Diz o nome').max(40, 'Nome curto, até 40 letras'),
});
export const linkPersonBody = z.object({
  personName: z.string().trim().min(1, 'Diz o nome').max(40, 'Nome curto, até 40 letras').nullable(),
});
/** Acerto anotado à mão (dinheiro vivo, combinado de boca). */
export const personEntryBody = z.object({
  kind: z.enum(['emprestei', 'peguei', 'recebi', 'paguei']),
  amountInCents: z.number().int().positive('Valor precisa ser maior que zero').max(100_000_000),
  description: z.string().trim().max(80).optional(),
  occurredAt: z.iso.date(),
});
export type PersonEntryBody = z.infer<typeof personEntryBody>;

export type SearchResponse = {
  /** Uma página (do mais recente pro mais antigo). */
  transactions: TransactionDTO[];
  /** Total achado em TODAS as páginas (não só nesta). */
  count: number;
  /** Soma de saídas / entradas de todas as páginas (transferência interna não entra na soma). */
  outInCents: number;
  inInCents: number;
  /** Passe em `cursor` pra pedir a próxima página; null = acabou. */
  nextCursor: string | null;
};

/** kind "neutra" = "Não conta" (some do gasto e da renda). custom = criada pela pessoa. */
export type CategoryDTO = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: 'saida' | 'entrada' | 'neutra';
  custom: boolean;
};

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
  accounts: {
    id: string;
    name: string;
    type: 'BANK' | 'CREDIT';
    balanceInCents: number;
    creditLimitInCents: number | null;
    dueDate: string | null;
    brand: string | null;
    last4: string | null;
  }[];
  /** Contas que a pessoa ocultou: fora do saldo e da lista. */
  hiddenAccounts: { id: string; name: string; balanceInCents: number }[];
};

export type TransactionDetailResponse = { transaction: TransactionDTO; rulePattern: string };

/** Logo oficial de cada banco (GET /institutions/logos). */
export type InstitutionLogosResponse = { logos: { name: string; imageUrl: string; color: string | null }[] };

/** Detalhe de uma conta ou cartão num mês (GET /accounts/:id?month=). */
export type AccountDetailResponse = {
  account: {
    id: string;
    name: string;
    type: 'BANK' | 'CREDIT';
    institution: string | null;
    /** Cartão: negativo = fatura em aberto. */
    balanceInCents: number;
    creditLimitInCents: number | null;
    dueDate: string | null;
    lastSyncedAt: string | null;
    hidden: boolean;
    /** Cartão: bandeira (VISA, MASTERCARD, ELO...) e final, quando o banco manda. */
    brand: string | null;
    last4: string | null;
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
export type SubscriptionsResponse = {
  subscriptions: SubscriptionDTO[];
  ignored: SubscriptionDTO[];
  monthlyInCents: number;
  yearlyInCents: number;
};
export const ignoreSubscriptionBody = z.object({ key: z.string().min(1).max(200), ignored: z.boolean() });

// ---------- Limites por categoria ----------
export const setBudgetBody = z.object({
  // null tira o limite
  limitInCents: z.number().int().positive('O limite precisa ser maior que zero').max(100_000_000).nullable(),
});
export type SetBudgetBody = z.infer<typeof setBudgetBody>;
export type BudgetDTO = {
  categoryId: string;
  name: string;
  emoji: string;
  color: string;
  limitInCents: number;
  spentInCents: number;
};
export type BudgetsResponse = { budgets: BudgetDTO[] };

// ---------- Progresso das lições ----------
export const lessonIdParam = z.object({ lessonId: z.string().regex(/^m\d+-l\d+$/, 'Lição inválida') });
/** streakDays = ofensiva (dias seguidos com lição); doneToday = lições feitas hoje (Brasília). */
export type LessonProgressResponse = { done: string[]; streakDays: number; doneToday: number; bonusXp: number };

// Jogos: Tribunal do Tostão e Batalhas
// Todo caso do Tribunal tem exatamente 2 opções: 0 ou 1.
export const tribunalVoteBody = z.object({ caseId: shortId, choice: z.number().int().min(0).max(1) });
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
  tigrinho: {
    status: 'ativa' | 'vencida' | 'perdida';
    startedAt: string;
    day: number;
    totalDays: number;
    lostAt: string | null;
  } | null;
  urubu: { status: 'bloqueada' | 'ativa' | 'vencida'; steps: { id: string; label: string; done: boolean }[] };
};

// Chat com o Tostão
export const chatBody = z.object({
  message: z.string().trim().min(1, 'Escreve alguma coisa').max(1000, 'Pergunta longa demais'),
});
export type ChatMessageDTO = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };
export type ChatHistoryResponse = { messages: ChatMessageDTO[] };
/**
 * Ação que a IA PROPÔS e que só vale depois do "confirmar" da pessoa (nada é gravado antes disso).
 * Vive 5 minutos no servidor; confirmar ou cancelar é de uso único.
 */
export type PendingActionDTO = {
  id: string;
  kind: 'registrar_transacao';
  summary: string;
  description: string;
  amountInCents: number;
  type: 'saida' | 'entrada';
  categoryName: string | null;
  date: string; // YYYY-MM-DD
  expiresAt: string;
};
export type ChatReplyResponse = {
  question: ChatMessageDTO;
  reply: ChatMessageDTO;
  remainingToday: number;
  pendingAction: PendingActionDTO | null;
};
export const pendingActionBody = z.object({ actionId: z.string().min(8).max(64) });
export type ConfirmPendingActionResponse = { ok: true; message: string; transactionId?: string };

// Consentimentos (LGPD). Hoje só o uso de IA; vira tabela UserConsent na Fase 1.
export const consentsBody = z.object({ aiConsent: z.boolean() });
export type ConsentsResponse = { aiConsentAt: string | null };

// Importar extrato (OFX/CSV)
export const importStatementBody = z.object({
  accountName: z.string().trim().max(40).default(''),
  fileName: z.string().max(200),
  content: z.string().min(10, 'Arquivo vazio').max(4_000_000, 'Arquivo grande demais (máx. 4 MB)'),
  isCard: z.boolean().optional(),
  /** Só cartão: como o arquivo representa compra. 'auto' (padrão) descobre pelos números; as outras forçam. */
  signConvention: z.enum(['auto', 'compras-positivas', 'compras-negativas']).optional(),
});
export type ImportResponse = {
  importedCount: number;
  skipped: number;
  format: 'ofx' | 'csv';
  kind: 'BANK' | 'CREDIT';
  accountName: string;
  from: string;
  to: string;
};

// ---------- Renda, contas fixas e previsão ----------
const cents = z.number().int().min(0).max(100_000_000);
const day = z.number().int().min(1).max(31);
/** Uma meta financeira. savedInCents = quanto já guardou; o app soma com "Guardei". */
export const goalBody = z.object({
  id: z.string().min(1).max(64).optional(),
  kind: z.enum(['reserva', 'viagem', 'sair-do-vermelho', 'outro']),
  label: z.string().trim().max(60).nullable().default(null),
  amountInCents: cents.nullable().default(null),
  deadline: z.string().regex(MONTH_PATTERN, 'Use AAAA-MM (mês de 01 a 12)').nullable().default(null),
  savedInCents: cents.optional(),
});
export type Goal = z.infer<typeof goalBody>;
/** "Guardei R$ 50" (positivo) ou "tirei R$ 20" (negativo). */
export const goalDepositBody = z.object({
  goalId: z.string().min(1).max(64).optional(),
  amountInCents: z
    .number()
    .int()
    .min(-100_000_000)
    .max(100_000_000)
    .refine((v) => v !== 0, 'Valor precisa ser diferente de zero'),
});

export const financialPlanBody = z.object({
  salary: z
    .object({
      amountInCents: cents,
      payday: day,
      varies: z.boolean().default(false),
      bank: z.string().trim().max(60).nullable().default(null),
      /** Adiantamento: parte do salário que cai antes, ex.: metade no dia 15. amountInCents é o total do mês. */
      advance: z.object({ day, amountInCents: cents }).nullable().default(null),
      /** Padrão da descrição no extrato (ex.: "TRANSF SALDO C/SAL P/CC"). */
      pattern: z.string().trim().max(120).nullable().default(null),
    })
    // O adiantamento é parte do salário: não pode passar do total.
    .refine((s) => !s.advance || s.advance.amountInCents <= s.amountInCents, {
      message: 'O adiantamento não pode ser maior que o salário',
      path: ['advance'],
    })
    .nullable(),
  otherIncomes: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        amountInCents: cents,
        day: day.nullable().default(null),
        countsAsIncome: z.boolean(),
        pattern: z.string().trim().max(120).nullable().default(null),
      }),
    )
    .max(10)
    .default([]),
  fixedExpenses: z
    .array(z.object({ name: z.string().trim().min(1).max(60), amountInCents: cents, day }))
    .max(20)
    .default([]),
  /** VR e VA: não passam pelo Open Finance, a pessoa informa. Só servem pra comida, não entram no caixa. */
  benefits: z
    .array(z.object({ kind: z.enum(['VR', 'VA', 'outro']), amountInCents: cents, day }))
    .max(4)
    .default([]),
  goal: goalBody.nullable().default(null),
  goals: z.array(goalBody).max(10).optional(),
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
  id?: string;
  kind?: Goal['kind'];
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
export type ForecastResponse = {
  hasPlan: boolean;
  months: ForecastMonth[];
  goal: GoalStatus | null;
  goals?: GoalStatus[];
  thisMonth: ThisMonthForecast | null;
  base?: SpendingBase | null;
};
/** Quantas pendentes a IA categorizou (das que ela olhou). */
export type AutoCategorizeResponse = { categorized: number; asked: number; skipped?: 'consent' | 'quota' };

// ---------- Missões, ofensiva, amigos, avisos e resumo da semana ----------
/** O que conta como missão feita. "visita:*" vem das telas que a missão do dia manda abrir. */
/**
 * Missões que o SERVIDOR marca sozinho quando a ação acontece de verdade (lição, categorizar, anotar...).
 * Ficam fora de POST /activity: a pessoa não pode "declarar" que fez e ganhar XP.
 */
export const ACTIVITY_KINDS = [
  'licao',
  'categorizar',
  'anotar',
  'tribunal',
  'batalha',
  'meta',
  'limites',
  'assinaturas',
  'chat',
  'visita:previsao',
  'visita:assinaturas',
  'visita:limites',
  'visita:fechamento',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
/** Só as visitas a telas podem ser avisadas pelo cliente (POST /activity); o resto o servidor deriva. */
export const ACTIVITY_VISIT_KINDS = ACTIVITY_KINDS.filter((k) => k.startsWith('visita:')) as Extract<
  (typeof ACTIVITY_KINDS)[number],
  `visita:${string}`
>[];
export const activityBody = z.object({ kind: z.enum(ACTIVITY_VISIT_KINDS as [string, ...string[]]) });

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
/** Pedido de amizade pendente (quem pediu ou pra quem foi). Só o primeiro nome: nada de dinheiro nem e-mail. */
export type FriendRequestDTO = { id: string; name: string; createdAt: string };
export type FriendsResponse = {
  code: string;
  challenge: { title: string; endsAt: string };
  ranking: FriendDTO[];
  /** Pedidos que a pessoa recebeu (precisa aceitar ou recusar) e os que ela mandou (esperando resposta). */
  requests: { incoming: FriendRequestDTO[]; outgoing: FriendRequestDTO[] };
};
export const addFriendBody = z.object({ code: z.string().trim().min(4).max(20) });

export type ReminderDTO = {
  key: string;
  kind: 'fatura' | 'conta' | 'assinatura';
  title: string;
  amountInCents: number | null;
  dueDate: string;
  daysLeft: number;
};
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

// A allowlist de hosts do Web Push fica na API (apps/api/src/lib/push-endpoint.ts). Aqui só o formato.
const httpsNoCredentials = (raw: string) => {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port;
  } catch {
    return false;
  }
};
const base64url = /^[A-Za-z0-9_-]+={0,2}$/;

export const pushSubscriptionBody = z.object({
  endpoint: z.string().url().max(1000).refine(httpsNoCredentials, 'Endpoint de push inválido'),
  keys: z.object({
    // p256dh = ponto P-256 sem compressão (65 bytes ≈ 87 chars); auth = 16 bytes ≈ 22 chars.
    p256dh: z.string().min(80).max(100).regex(base64url, 'Chave inválida'),
    auth: z.string().min(16).max(32).regex(base64url, 'Chave inválida'),
  }),
});
export const pushUnsubscribeBody = z.object({ endpoint: z.string().url().max(1000) });
export type PushKeyResponse = { publicKey: string | null; subscribed: number };

// ---------- Funções automáticas do Tostão & Caramelo ----------
export const TOSTAO_ROUTINES = ['caramelo_extrato', 'tostao_previsao', 'guardiao_limites', 'olheiro_acertos'] as const;
export type TostaoRoutineKey = (typeof TOSTAO_ROUTINES)[number];
export type TostaoInsightSeverity = 'info' | 'warning' | 'urgent';
export type TostaoInsightStatus = 'PENDING' | 'APPLIED' | 'DISMISSED';

export type TostaoInsightDTO = {
  id: string;
  routine: TostaoRoutineKey;
  kind: string;
  severity: TostaoInsightSeverity;
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string | null;
  canApply: boolean;
  payload: Record<string, unknown>;
  status: TostaoInsightStatus;
  createdAt: string;
  actedAt: string | null;
};

export type TostaoAutoConfigDTO = {
  carameloExtrato: boolean;
  tostaoPrevisao: boolean;
  guardiaoLimites: boolean;
  olheiroAcertos: boolean;
  notifyPush: boolean;
  notifyWhatsapp: boolean;
  lastCheckedAt: string | null;
};

export const updateTostaoAutoConfigBody = z.object({
  carameloExtrato: z.boolean().optional(),
  tostaoPrevisao: z.boolean().optional(),
  guardiaoLimites: z.boolean().optional(),
  olheiroAcertos: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
});
export type UpdateTostaoAutoConfigBody = z.infer<typeof updateTostaoAutoConfigBody>;

export type TostaoAutoResponse = {
  insights: TostaoInsightDTO[];
  history: TostaoInsightDTO[];
  config: TostaoAutoConfigDTO;
};

export type RunTostaoCheckResponse = TostaoAutoResponse & {
  generated: number;
};

export type ApplyTostaoInsightResponse = {
  insight: TostaoInsightDTO;
  redirectTo: string | null;
  appliedSummary: string;
};

import {
  AddPersonEntryUseCase,
  DeletePersonUseCase,
  EnsurePersonUseCase,
  GetPersonUseCase,
  LinkTransactionPersonUseCase,
  ListPeopleUseCase,
  RenamePersonUseCase,
} from './people.js';
import { ListLessonProgressUseCase } from './lesson-progress.js';
import { GamesUseCase } from './games.js';
import { EngagementUseCase } from './engagement.js';
import { ImportStatementUseCase } from './import-statement.js';
import { ImportPdfUseCase } from './import-pdf.js';
import { RecurringRulesUseCase } from './recurring-rules.js';
import { ReconcileBalanceUseCase } from './reconcile-balance.js';
import { TransferLinkUseCase } from './transfer-link.js';
import { AutomationTokensUseCase, ShortcutWebhookUseCase } from './automation.js';
import { CreateInviteUseCase, ListInvitesUseCase } from './invites.js';
import { RequestPasswordResetUseCase, ResetPasswordUseCase } from './password-reset.js';
import { SessionsUseCase } from './sessions.js';
import { BackgroundTasks, SendEmailVerificationUseCase, VerifyEmailUseCase } from './email-verification.js';
import { FakeEmailGateway, type EmailGateway } from '../gateways/email-gateway.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { CreateCategoryUseCase, DeleteCategoryUseCase } from './categories.js';
// Monta os use cases com as dependências certas. É a única parte que "sabe" de tudo.
// O controller pede um use case pronto e não se preocupa com o que tem dentro.
import type { Repositories } from '../repositories/types.js';
import type { BankGateway } from '../gateways/bank-gateway.js';
import { FakeAiGateway, type AiGateway } from '../gateways/ai-gateway.js';
import { FakeWhatsAppGateway, type WhatsAppGateway } from '../gateways/whatsapp-gateway.js';
import { DisabledOAuthGateway, type OAuthGateway } from '../gateways/oauth-gateway.js';
import { HandleWhatsAppMessageUseCase, WhatsAppLinkUseCase } from './whatsapp.js';
import { testOnlyKeyValueStore, type KeyValueStore } from '../lib/redis.js';
import { AskTostaoUseCase } from './ask-tostao.js';
import { SetAiConsentUseCase } from './ai-consent.js';
import { PixKeyUseCase } from './pix-key.js';
import { CheckScamUseCase } from './check-scam.js';
import { PendingActionUseCase } from './pending-actions.js';
import { PendingActionStore } from '../services/pending-actions.js';
import { RegisterUserUseCase } from './register-user.js';
import { AuthenticateUseCase } from './authenticate.js';
import { AuthenticateOAuthUseCase } from './authenticate-oauth.js';
import { GetProfileUseCase } from './get-profile.js';
import { SyncBankConnectionUseCase } from './sync-bank-connection.js';
import { ConnectBankUseCase } from './connect-bank.js';
import { DisconnectBankUseCase } from './disconnect-bank.js';
import { InstitutionLogosUseCase } from './institution-logos.js';
import { DeleteTransactionUseCase } from './delete-transaction.js';
import { DeleteAccountUseCase } from './delete-account.js';
import { ExportUserDataUseCase } from './export-user-data.js';
import { ExportTransactionsCsvUseCase } from './export-transactions-csv.js';
import { CategorizeTransactionUseCase } from './categorize-transaction.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';
import { UpdateTransactionUseCase } from './update-transaction.js';
import { CreateManualAccountUseCase } from './create-manual-account.js';
import { ListTransactionsUseCase } from './list-transactions.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import { GetSummaryHistoryUseCase } from './get-summary-history.js';
import { AccountDetailUseCase } from './account-detail.js';
import { GetTransactionUseCase } from './get-transaction.js';
import { ListSubscriptionsUseCase } from './list-subscriptions.js';
import { GetBudgetsUseCase, SetBudgetUseCase } from './budgets.js';
import { AutoCategorizeUseCase } from './auto-categorize.js';
import { SearchTransactionsUseCase } from './search-transactions.js';
import { ListNotesUseCase } from './list-notes.js';
import {
  ForecastUseCase,
  GoalDepositUseCase,
  SaveFinancialPlanUseCase,
  SetGoalUseCase,
  SuggestIncomeUseCase,
} from './financial-plan.js';
import {
  ApplyTostaoInsightUseCase,
  DismissTostaoInsightUseCase,
  GetTostaoAutoUseCase,
  RunTostaoChecksUseCase,
  UpdateTostaoAutoConfigUseCase,
} from './tostao-auto.js';

export type Deps = {
  repos: Repositories;
  bank: BankGateway;
  ai?: AiGateway;
  whatsapp?: WhatsAppGateway;
  oauth?: OAuthGateway;
  /** Estado de curta duração e limites de tentativa (Redis). Memória só em NODE_ENV=test. */
  kv?: KeyValueStore;
  chatDailyLimit?: number;
  /** E-mail transacional (Resend em produção, Fake em dev/teste). */
  email?: EmailGateway;
  /** Origem pública do site (WEB_ORIGIN): base dos links enviados por e-mail. */
  appUrl?: string;
};

export function makeUseCases({
  repos,
  bank,
  ai = new FakeAiGateway(),
  whatsapp = new FakeWhatsAppGateway(),
  oauth = new DisabledOAuthGateway(),
  kv = testOnlyKeyValueStore(),
  chatDailyLimit = 40,
  email = new FakeEmailGateway(),
  appUrl = '',
}: Deps) {
  const emailTasks = new BackgroundTasks();
  const sendEmailVerification = new SendEmailVerificationUseCase(repos, email, appUrl, emailTasks);
  const sync = new SyncBankConnectionUseCase({ ...repos, bank });
  const autoCategorize = new AutoCategorizeUseCase(repos, ai, kv);
  const pendingStore = new PendingActionStore(kv);
  const askTostao = new AskTostaoUseCase(repos, ai, chatDailyLimit, () => new Date(), kv, pendingStore);
  const pendingActions = new PendingActionUseCase(pendingStore, repos);
  const checkScam = new CheckScamUseCase(repos, ai, chatDailyLimit, kv);
  const createManualTransaction = new CreateManualTransactionUseCase(repos);
  const runTostaoChecks = new RunTostaoChecksUseCase(repos);
  const importStatement = new ImportStatementUseCase(repos);
  return {
    registerUser: new RegisterUserUseCase(repos, sendEmailVerification),
    sessions: new SessionsUseCase(repos),
    sendEmailVerification,
    verifyEmail: new VerifyEmailUseCase(repos),
    requestPasswordReset: new RequestPasswordResetUseCase(repos, email, appUrl, emailTasks),
    /** Espera os e-mails em andamento (testes, scripts, desligamento). */
    drainEmails: () => emailTasks.drain(),
    createInvite: new CreateInviteUseCase(repos),
    listInvites: new ListInvitesUseCase(repos),
    resetPassword: new ResetPasswordUseCase(repos, email, emailTasks),
    authenticate: new AuthenticateUseCase(repos.users),
    authenticateOAuth: new AuthenticateOAuthUseCase(repos, oauth),
    getProfile: new GetProfileUseCase(
      repos.users,
      repos.connections,
      repos.accounts,
      repos.oauthAccounts,
      bank.supportsWidget,
    ),
    syncBankConnection: sync,
    connectBank: new ConnectBankUseCase(repos.connections, bank, sync),
    institutionLogos: new InstitutionLogosUseCase(bank),
    deleteTransaction: new DeleteTransactionUseCase(repos),
    disconnectBank: new DisconnectBankUseCase(repos, bank),
    deleteAccount: new DeleteAccountUseCase(repos, bank),
    exportUserData: new ExportUserDataUseCase(repos),
    exportTransactionsCsv: new ExportTransactionsCsvUseCase(repos),
    createConnectToken: {
      execute: async ({ userId }: { userId: string }) => ({ connectToken: await bank.createConnectToken(userId) }),
    },
    categorizeTransaction: new CategorizeTransactionUseCase(repos),
    createManualTransaction,
    updateTransaction: new UpdateTransactionUseCase(repos),
    createManualAccount: new CreateManualAccountUseCase(repos),
    listTransactions: new ListTransactionsUseCase(repos),
    listPeople: new ListPeopleUseCase(repos),
    ensurePerson: new EnsurePersonUseCase(repos),
    getPerson: new GetPersonUseCase(repos),
    linkTransactionPerson: new LinkTransactionPersonUseCase(repos),
    addPersonEntry: new AddPersonEntryUseCase(repos),
    deletePerson: new DeletePersonUseCase(repos),
    renamePerson: new RenamePersonUseCase(repos),
    searchTransactions: new SearchTransactionsUseCase(repos),
    listNotes: new ListNotesUseCase(repos),
    getMonthSummary: new GetMonthSummaryUseCase(repos),
    getSummaryHistory: new GetSummaryHistoryUseCase(repos),
    accountDetail: new AccountDetailUseCase(repos),
    getTransaction: new GetTransactionUseCase(repos),
    listSubscriptions: new ListSubscriptionsUseCase(repos),
    setSubscriptionIgnored: {
      execute: ({ userId, key, ignored }: { userId: string; key: string; ignored: boolean }) =>
        repos.ignoredSubscriptions.set(userId, key, ignored),
    },
    getBudgets: new GetBudgetsUseCase(repos),
    setBudget: new SetBudgetUseCase(repos),
    getPlan: { execute: async ({ userId }: { userId: string }) => ({ plan: await repos.plans.get(userId) }) },
    savePlan: new SaveFinancialPlanUseCase(repos),
    suggestIncome: new SuggestIncomeUseCase(repos),
    forecast: new ForecastUseCase(repos),
    setGoal: new SetGoalUseCase(repos),
    goalDeposit: new GoalDepositUseCase(repos),
    listLessonProgress: new ListLessonProgressUseCase(repos),
    games: new GamesUseCase(repos),
    engagement: new EngagementUseCase(repos),
    markLessonDone: {
      execute: ({ userId, lessonId }: { userId: string; lessonId: string }) => repos.lessons.markDone(userId, lessonId),
    },
    listCategories: {
      execute: async ({ userId }: { userId?: string }) => ({ categories: await repos.categories.list(userId) }),
    },
    createCategory: new CreateCategoryUseCase(repos),
    importStatement,
    importPdf: new ImportPdfUseCase(repos, importStatement, ai, kv),
    recurringRules: new RecurringRulesUseCase(repos),
    reconcileBalance: new ReconcileBalanceUseCase(repos),
    transferLink: new TransferLinkUseCase(repos),
    automationTokens: new AutomationTokensUseCase(repos),
    shortcutWebhook: new ShortcutWebhookUseCase(repos, createManualTransaction),
    autoCategorize,
    askTostao,
    pendingActions,
    setAiConsent: new SetAiConsentUseCase(repos),
    pixKey: new PixKeyUseCase(repos),
    checkScam,
    whatsappLink: new WhatsAppLinkUseCase(repos, whatsapp),
    whatsappMessage: new HandleWhatsAppMessageUseCase(
      repos,
      whatsapp,
      askTostao,
      undefined,
      {
        create: createManualTransaction,
        categorize: autoCategorize,
        repos,
      },
      kv,
      pendingActions,
      checkScam,
    ),
    chatHistory: {
      execute: async ({ userId }: { userId: string }) => ({ messages: await repos.chat.listRecent(userId, 60) }),
    },
    setAccountHidden: {
      execute: async ({ userId, accountId, hidden }: { userId: string; accountId: string; hidden: boolean }) => {
        const account = (await repos.accounts.listByUser(userId)).find((a) => a.id === accountId);
        if (!account) throw new ResourceNotFoundError('Conta');
        await repos.accounts.setHidden(accountId, hidden);
      },
    },
    deleteCategory: new DeleteCategoryUseCase(repos),
    getTostaoAuto: new GetTostaoAutoUseCase(repos),
    runTostaoChecks,
    applyTostaoInsight: new ApplyTostaoInsightUseCase(repos, autoCategorize),
    dismissTostaoInsight: new DismissTostaoInsightUseCase(repos),
    updateTostaoAutoConfig: new UpdateTostaoAutoConfigUseCase(repos),
  };
}
export type UseCases = ReturnType<typeof makeUseCases>;

import { ListLessonProgressUseCase } from './lesson-progress.js';
import { GamesUseCase } from './games.js';
import { ImportStatementUseCase } from './import-statement.js';
import { CreateInviteUseCase, ListInvitesUseCase } from './invites.js';
import { ResetPasswordUseCase } from './password-reset.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { CreateCategoryUseCase, DeleteCategoryUseCase } from './categories.js';
// Monta os use cases com as dependências certas. É a única parte que "sabe" de tudo.
// O controller pede um use case pronto e não se preocupa com o que tem dentro.
import type { Repositories } from '../repositories/types.js';
import type { BankGateway } from '../gateways/bank-gateway.js';
import { FakeAiGateway, type AiGateway } from '../gateways/ai-gateway.js';
import { FakeWhatsAppGateway, type WhatsAppGateway } from '../gateways/whatsapp-gateway.js';
import { HandleWhatsAppMessageUseCase, WhatsAppLinkUseCase } from './whatsapp.js';
import { AskTostaoUseCase } from './ask-tostao.js';
import { RegisterUserUseCase } from './register-user.js';
import { AuthenticateUseCase } from './authenticate.js';
import { GetProfileUseCase } from './get-profile.js';
import { SyncBankConnectionUseCase } from './sync-bank-connection.js';
import { ConnectBankUseCase } from './connect-bank.js';
import { DisconnectBankUseCase } from './disconnect-bank.js';
import { DeleteAccountUseCase } from './delete-account.js';
import { CategorizeTransactionUseCase } from './categorize-transaction.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';
import { ListTransactionsUseCase } from './list-transactions.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import { GetTransactionUseCase } from './get-transaction.js';
import { ListSubscriptionsUseCase } from './list-subscriptions.js';
import { GetBudgetsUseCase, SetBudgetUseCase } from './budgets.js';
import { AutoCategorizeUseCase } from './auto-categorize.js';
import { SearchTransactionsUseCase } from './search-transactions.js';
import { ForecastUseCase, GoalDepositUseCase, SaveFinancialPlanUseCase, SetGoalUseCase, SuggestIncomeUseCase } from './financial-plan.js';

export type Deps = { repos: Repositories; bank: BankGateway; ai?: AiGateway; whatsapp?: WhatsAppGateway; chatDailyLimit?: number };

export function makeUseCases({ repos, bank, ai = new FakeAiGateway(), whatsapp = new FakeWhatsAppGateway(), chatDailyLimit = 40 }: Deps) {
  const sync = new SyncBankConnectionUseCase({ ...repos, bank });
  const autoCategorize = new AutoCategorizeUseCase(repos, ai);
  const askTostao = new AskTostaoUseCase(repos, ai, chatDailyLimit);
  return {
    registerUser: new RegisterUserUseCase(repos),
    createInvite: new CreateInviteUseCase(repos),
    listInvites: new ListInvitesUseCase(repos),
    resetPassword: new ResetPasswordUseCase(repos),
    authenticate: new AuthenticateUseCase(repos.users),
    getProfile: new GetProfileUseCase(repos.users, repos.connections, repos.accounts),
    syncBankConnection: sync,
    connectBank: new ConnectBankUseCase(repos.connections, bank, sync),
    disconnectBank: new DisconnectBankUseCase(repos.connections, bank),
    deleteAccount: new DeleteAccountUseCase(repos, bank),
    createConnectToken: { execute: async ({ userId }: { userId: string }) => ({ connectToken: await bank.createConnectToken(userId) }) },
    categorizeTransaction: new CategorizeTransactionUseCase(repos),
    createManualTransaction: new CreateManualTransactionUseCase(repos),
    listTransactions: new ListTransactionsUseCase(repos),
    searchTransactions: new SearchTransactionsUseCase(repos),
    getMonthSummary: new GetMonthSummaryUseCase(repos),
    getTransaction: new GetTransactionUseCase(repos),
    listSubscriptions: new ListSubscriptionsUseCase(repos),
    setSubscriptionIgnored: { execute: ({ userId, key, ignored }: { userId: string; key: string; ignored: boolean }) => repos.ignoredSubscriptions.set(userId, key, ignored) },
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
    markLessonDone: { execute: ({ userId, lessonId }: { userId: string; lessonId: string }) => repos.lessons.markDone(userId, lessonId) },
    listCategories: { execute: async ({ userId }: { userId?: string }) => ({ categories: await repos.categories.list(userId) }) },
    createCategory: new CreateCategoryUseCase(repos),
    importStatement: new ImportStatementUseCase(repos),
    autoCategorize,
    askTostao,
    whatsappLink: new WhatsAppLinkUseCase(repos, whatsapp),
    whatsappMessage: new HandleWhatsAppMessageUseCase(repos, whatsapp, askTostao),
    chatHistory: { execute: async ({ userId }: { userId: string }) => ({ messages: await repos.chat.listRecent(userId, 60) }) },
    setAccountHidden: {
      execute: async ({ userId, accountId, hidden }: { userId: string; accountId: string; hidden: boolean }) => {
        const account = (await repos.accounts.listByUser(userId)).find((a) => a.id === accountId);
        if (!account) throw new ResourceNotFoundError('Conta');
        await repos.accounts.setHidden(accountId, hidden);
      },
    },
    deleteCategory: new DeleteCategoryUseCase(repos),
  };
}
export type UseCases = ReturnType<typeof makeUseCases>;

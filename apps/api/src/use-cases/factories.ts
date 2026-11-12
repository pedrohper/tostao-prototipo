import { CreateInviteUseCase, ListInvitesUseCase } from './invites.js';
import { ResetPasswordUseCase } from './password-reset.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { CreateCategoryUseCase, DeleteCategoryUseCase } from './categories.js';
// Monta os use cases com as dependências certas. É a única parte que "sabe" de tudo.
// O controller pede um use case pronto e não se preocupa com o que tem dentro.
import type { Repositories } from '../repositories/types.js';
import type { BankGateway } from '../gateways/bank-gateway.js';
import { RegisterUserUseCase } from './register-user.js';
import { AuthenticateUseCase } from './authenticate.js';
import { GetProfileUseCase } from './get-profile.js';
import { SyncBankConnectionUseCase } from './sync-bank-connection.js';
import { ConnectBankUseCase } from './connect-bank.js';
import { DisconnectBankUseCase } from './disconnect-bank.js';
import { CategorizeTransactionUseCase } from './categorize-transaction.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';
import { ListTransactionsUseCase } from './list-transactions.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import { GetTransactionUseCase } from './get-transaction.js';
import { ListSubscriptionsUseCase } from './list-subscriptions.js';
import { GetBudgetsUseCase, SetBudgetUseCase } from './budgets.js';

export type Deps = { repos: Repositories; bank: BankGateway };

export function makeUseCases({ repos, bank }: Deps) {
  const sync = new SyncBankConnectionUseCase({ ...repos, bank });
  return {
    registerUser: new RegisterUserUseCase(repos),
    createInvite: new CreateInviteUseCase(repos),
    listInvites: new ListInvitesUseCase(repos),
    resetPassword: new ResetPasswordUseCase(repos),
    authenticate: new AuthenticateUseCase(repos.users),
    getProfile: new GetProfileUseCase(repos.users, repos.connections),
    syncBankConnection: sync,
    connectBank: new ConnectBankUseCase(repos.connections, bank, sync),
    disconnectBank: new DisconnectBankUseCase(repos.connections, bank),
    createConnectToken: { execute: async ({ userId }: { userId: string }) => ({ connectToken: await bank.createConnectToken(userId) }) },
    categorizeTransaction: new CategorizeTransactionUseCase(repos),
    createManualTransaction: new CreateManualTransactionUseCase(repos),
    listTransactions: new ListTransactionsUseCase(repos),
    getMonthSummary: new GetMonthSummaryUseCase(repos),
    getTransaction: new GetTransactionUseCase(repos),
    listSubscriptions: new ListSubscriptionsUseCase(repos),
    setSubscriptionIgnored: { execute: ({ userId, key, ignored }: { userId: string; key: string; ignored: boolean }) => repos.ignoredSubscriptions.set(userId, key, ignored) },
    getBudgets: new GetBudgetsUseCase(repos),
    setBudget: new SetBudgetUseCase(repos),
    listLessonProgress: { execute: async ({ userId }: { userId: string }) => ({ done: (await repos.lessons.listByUser(userId)).map((l) => l.lessonId) }) },
    markLessonDone: { execute: ({ userId, lessonId }: { userId: string; lessonId: string }) => repos.lessons.markDone(userId, lessonId) },
    listCategories: { execute: async ({ userId }: { userId?: string }) => ({ categories: await repos.categories.list(userId) }) },
    createCategory: new CreateCategoryUseCase(repos),
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

import type {
  AccountsRepository,
  BankConnectionsRepository,
  OAuthAccountsRepository,
  UsersRepository,
} from '../repositories/types.js';
import type { Account, BankConnection } from '../domain/entities.js';
import { ResourceNotFoundError } from '../domain/errors.js';

export class GetProfileUseCase {
  constructor(
    private readonly users: UsersRepository,
    private readonly connections: BankConnectionsRepository,
    private readonly accounts: AccountsRepository,
    private readonly oauthAccounts: OAuthAccountsRepository,
  ) {}

  async execute({ userId }: { userId: string }) {
    const user = await this.users.findById(userId);
    if (!user) throw new ResourceNotFoundError('Usuário');
    const [connections, accounts, oauthAccounts] = await Promise.all([
      this.connections.listByUser(userId),
      this.accounts.listByUser(userId),
      this.oauthAccounts.listByUser(userId),
    ]);
    return {
      user,
      providers: oauthAccounts.map((o) => o.provider),
      connections: connections.map((c) => {
        const mine = accounts.filter((a) => a.connectionId === c.id);
        return { ...c, displayName: connectionName(c, mine), accounts: mine };
      }),
    };
  }
}

/** Conectores "ponte" (ex.: MeuPluggy) não dizem qual é o banco: aí o nome vem das contas. */
const GENERIC = /meu ?pluggy|pluggy/i;

export function connectionName(c: Pick<BankConnection, 'institution'>, accounts: Pick<Account, 'name' | 'type'>[]) {
  if (c.institution && !GENERIC.test(c.institution)) return c.institution;
  const bank = accounts.find((a) => a.type === 'BANK');
  if (bank) return bank.name.replace(/\s*\(Poupança\)$/, '');
  const card = accounts.find((a) => a.type === 'CREDIT');
  if (card) return titleCase(card.name);
  return c.institution ?? 'Banco';
}

function titleCase(s: string) {
  // "AMAZON MASTERCARD PLATINUM" -> "Amazon Mastercard Platinum"; nomes já misturados ficam como estão
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
}

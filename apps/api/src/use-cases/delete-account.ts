import bcrypt from 'bcryptjs';
import type { BankGateway } from '../gateways/bank-gateway.js';
import type { Repositories } from '../repositories/types.js';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';
import { isImportConnection } from './import-statement.js';

/**
 * "Apagar minha conta" (LGPD, art. 18, VI): pede a senha de novo, desliga os bancos
 * no provedor (pra Pluggy parar de ler) e apaga a pessoa. Contas, transações, metas,
 * chat, progresso e convites vão junto pelo onDelete: Cascade.
 * Se o provedor falhar, apaga aqui mesmo assim: a pessoa pediu pra sumir.
 */
export class DeleteAccountUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users' | 'connections'>,
    private readonly bank: BankGateway,
  ) {}

  async execute({ userId, password }: { userId: string; password: string }) {
    const user = await this.repos.users.findById(userId);
    if (!user) throw new ResourceNotFoundError('Conta');
    // 403, não 401: a web trata 401 como sessão vencida e deslogaria a pessoa.
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new AppError('Senha não confere.', 403);

    let providerFailures = 0;
    for (const connection of await this.repos.connections.listByUser(userId)) {
      if (isImportConnection(connection.itemId)) continue;
      try {
        await this.bank.deleteItem(connection.itemId);
      } catch {
        providerFailures++;
      }
    }
    await this.repos.users.delete(userId);
    return { providerFailures };
  }
}

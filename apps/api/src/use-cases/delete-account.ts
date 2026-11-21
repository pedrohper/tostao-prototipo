import type { BankGateway } from '../gateways/bank-gateway.js';
import type { Repositories } from '../repositories/types.js';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';
import { verifyPassword } from '../lib/password.js';
import { isImportConnection } from './import-statement.js';

/**
 * "Apagar minha conta" (LGPD, art. 18, VI): pede a senha de novo, desliga os bancos
 * no provedor (pra Pluggy parar de ler) e apaga a pessoa. Contas, transações, metas,
 * chat, progresso e convites vão junto pelo onDelete: Cascade.
 * Se o provedor falhar, apaga aqui mesmo assim: a pessoa pediu pra sumir.
 */
export class DeleteAccountUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users' | 'connections' | 'refreshTokens' | 'outbox' | 'audit' | 'tx'>,
    private readonly bank: BankGateway,
  ) {}

  async execute({ userId, password, confirmEmail }: { userId: string; password?: string; confirmEmail?: string }) {
    const user = await this.repos.users.findById(userId);
    if (!user) throw new ResourceNotFoundError('Conta');
    // 403, não 401: a web trata 401 como sessão vencida e deslogaria a pessoa.
    if (user.passwordHash) {
      if (!password || !(await verifyPassword(password, user.passwordHash))) {
        throw new AppError('Senha não confere.', 403);
      }
    } else {
      if (!confirmEmail || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
        throw new AppError('E-mail não confere.', 403);
      }
    }

    let providerFailures = 0;
    const failedItems: string[] = [];
    for (const connection of await this.repos.connections.listByUser(userId)) {
      if (isImportConnection(connection.itemId)) continue;
      try {
        await this.bank.deleteItem(connection.itemId);
      } catch {
        providerFailures++;
        failedItems.push(connection.itemId);
      }
    }
    // Tudo ou nada: sessões revogadas, desligamentos pendentes na fila (outbox, sobrevive à conta), auditoria e a
    // exclusão em si. Se o provedor estava fora do ar, o job tenta de novo depois, mesmo sem a pessoa existir mais.
    await this.repos.tx(async (r) => {
      await r.refreshTokens.revokeAllForUser(userId, new Date());
      for (const itemId of failedItems) await r.outbox.enqueue({ type: 'pluggy.deleteItem', payload: { itemId } });
      // Sem o id da pessoa de propósito: o evento fica, a identidade não (LGPD).
      await r.audit.record({ action: 'account_deleted', entityType: 'user', metadata: { providerFailures } });
      await r.users.delete(userId);
    });
    return { providerFailures };
  }
}

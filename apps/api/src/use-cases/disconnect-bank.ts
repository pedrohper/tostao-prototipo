import type { BankGateway } from '../gateways/bank-gateway.js';
import type { Repositories } from '../repositories/types.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { isImportConnection } from './import-statement.js';

/**
 * Tira um banco do Tostão: apaga o Item no provedor e a conexão aqui.
 * Só os lançamentos que vieram do banco (external_id) são apagados; gastos anotados na mão ficam,
 * mesmo os ligados a uma conta desse banco (eles perdem só o vínculo com a conta: account_id = NULL).
 * Se o provedor falhar, apaga aqui mesmo assim (a pessoa pediu pra sumir com o banco) e deixa o desligamento
 * do Item na fila (outbox) pra repetir depois.
 */
export class DisconnectBankUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'connections' | 'transactions' | 'outbox' | 'tx'>,
    private readonly bank: BankGateway,
  ) {}

  async execute({ userId, connectionId }: { userId: string; connectionId: string }) {
    const connection = await this.repos.connections.findById(connectionId);
    if (!connection || connection.userId !== userId) throw new ResourceNotFoundError('Conexão');

    let providerDeleted = true;
    const isImport = isImportConnection(connection.itemId);
    try {
      if (!isImport) await this.bank.deleteItem(connection.itemId);
    } catch {
      providerDeleted = false;
    }
    await this.repos.tx(async (r) => {
      if (!providerDeleted)
        await r.outbox.enqueue({ type: 'pluggy.deleteItem', payload: { itemId: connection.itemId } });
      await r.transactions.deleteBankByConnection(userId, connection.id);
      await r.connections.delete(connection.id);
    });
    return { providerDeleted };
  }
}

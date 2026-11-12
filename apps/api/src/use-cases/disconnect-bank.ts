import type { BankGateway } from '../gateways/bank-gateway.js';
import type { BankConnectionsRepository } from '../repositories/types.js';
import { ResourceNotFoundError } from '../domain/errors.js';

/**
 * Tira um banco do Tostão: apaga o Item no provedor e a conexão aqui
 * (junto vão as contas e transações importadas; gastos anotados na mão e regras ficam).
 * Se o provedor falhar, apaga aqui mesmo assim e avisa: a pessoa pediu pra sumir com o banco.
 */
export class DisconnectBankUseCase {
  constructor(
    private readonly connections: BankConnectionsRepository,
    private readonly bank: BankGateway,
  ) {}

  async execute({ userId, connectionId }: { userId: string; connectionId: string }) {
    const connection = await this.connections.findById(connectionId);
    if (!connection || connection.userId !== userId) throw new ResourceNotFoundError('Conexão');

    let providerDeleted = true;
    try {
      await this.bank.deleteItem(connection.itemId);
    } catch {
      providerDeleted = false;
    }
    await this.connections.delete(connection.id);
    return { providerDeleted };
  }
}

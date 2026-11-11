import type { BankGateway } from '../gateways/bank-gateway.js';
import type { BankConnectionsRepository } from '../repositories/types.js';
import type { SyncBankConnectionUseCase } from './sync-bank-connection.js';

/**
 * Liga um Item do Meu Pluggy ao usuário e já faz a primeira sincronização.
 * Se o Item já estava ligado, só sincroniza de novo.
 */
export class ConnectBankUseCase {
  constructor(
    private readonly connections: BankConnectionsRepository,
    private readonly bank: BankGateway,
    private readonly sync: SyncBankConnectionUseCase,
  ) {}

  async execute({ userId, itemId }: { userId: string; itemId: string }) {
    let connection = await this.connections.findByUserAndItem(userId, itemId);
    if (!connection) {
      const { institution } = await this.bank.fetchItem(itemId); // falha aqui se o Item ID não existe
      connection = await this.connections.create({ userId, itemId, institution });
    }
    const result = await this.sync.execute({ connectionId: connection.id });
    return { connection, ...result };
  }
}

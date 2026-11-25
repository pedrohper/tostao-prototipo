import { BankConnectionError, ConflictError, ForbiddenError } from '../domain/errors.js';
import type { BankGateway } from '../gateways/bank-gateway.js';
import type { BankConnectionsRepository } from '../repositories/types.js';
import type { SyncBankConnectionUseCase } from './sync-bank-connection.js';

export const CONNECTED_BUT_NOT_SYNCED =
  'Seu banco foi ligado, mas ainda não consegui puxar os lançamentos. Toca em "Sincronizar agora" daqui a pouco.';

/**
 * Liga um Item do Meu Pluggy ao usuário e já faz a primeira sincronização.
 * Se o Item já estava ligado, só sincroniza de novo.
 *
 * Um Item é de UMA pessoa só: sem essa trava, quem soubesse o itemId de outro cliente importava o extrato dele.
 * As respostas de erro não dizem de quem é o Item.
 */
export class ConnectBankUseCase {
  constructor(
    private readonly connections: BankConnectionsRepository,
    private readonly bank: BankGateway,
    private readonly sync: SyncBankConnectionUseCase,
  ) {}

  async execute({ userId, itemId }: { userId: string; itemId: string }) {
    let connection = await this.connections.findByUserAndItem(userId, itemId);
    const isNew = !connection;
    if (!connection) {
      // Já é de outra pessoa? Corta antes de falar com o provedor.
      if (await this.connections.findByItemId(itemId)) throw new ConflictError('Essa conexão não está disponível.');

      const item = await this.bank.fetchItem(itemId); // falha aqui se o Item ID não existe
      if (item.isSandbox && !this.bank.allowsSandbox) {
        throw new BankConnectionError('Esse banco é só de teste e não pode ser conectado.');
      }
      if (this.bank.enforcesItemOwnership && item.clientUserId !== userId) {
        throw new ForbiddenError('Essa conexão não pertence à sua conta. Conecte pelo botão do app.');
      }
      connection = await this.connections.create({ userId, itemId, institution: item.institution });
    }
    try {
      const result = await this.sync.execute({ connectionId: connection.id });
      return { connection, ...result };
    } catch (error) {
      if (!isNew) throw error;
      // A conexão já está salva: dizer "não deu pra conectar" mandaria a pessoa conectar de novo ou importar extrato.
      throw new BankConnectionError(CONNECTED_BUT_NOT_SYNCED);
    }
  }
}

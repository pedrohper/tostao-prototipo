import { randomUUID } from 'node:crypto';
import type { CreateManualAccountBody } from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import { MANUAL_PREFIX } from './import-statement.js';

/** Cria uma conta ou cartão manual (ex.: "Cartão do meu pai") sem depender do Pluggy. */
export class CreateManualAccountUseCase {
  constructor(private readonly repos: Pick<Repositories, 'connections' | 'accounts'>) {}

  async execute({ userId, name, type, balanceInCents }: CreateManualAccountBody & { userId: string }) {
    const itemId = `${MANUAL_PREFIX}contas`;
    let connection = await this.repos.connections.findByUserAndItem(userId, itemId);
    if (!connection) {
      connection = await this.repos.connections.create({ userId, itemId, institution: 'Contas manuais' });
    }
    const account = await this.repos.accounts.upsertByExternalId({
      userId,
      connectionId: connection.id,
      externalId: `${MANUAL_PREFIX}${randomUUID()}`,
      name,
      type,
      fingerprint: null,
      balanceInCents: type === 'CREDIT' ? -Math.abs(balanceInCents) : balanceInCents,
    });
    return { account };
  }
}

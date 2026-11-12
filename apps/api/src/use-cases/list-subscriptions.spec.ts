import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { ListSubscriptionsUseCase } from './list-subscriptions.js';

const NOW = new Date('2026-11-12T12:00:00Z');

describe('ListSubscriptionsUseCase', () => {
  it('"não é assinatura" tira da lista e do total, e dá pra desfazer', async () => {
    const repos = makeInMemoryRepositories();
    const add = (description: string, amountInCents: number, date: string) =>
      repos.transactions.create({ userId: 'u1', accountId: 'a1', externalId: null, description, amountInCents, occurredAt: new Date(`${date}T12:00:00Z`), categoryId: null, isInternalTransfer: false });
    await add('Dl*Spotify', -4090, '2026-09-06'); await add('Dl*Spotify', -4090, '2026-10-06'); await add('Dl*Spotify', -4090, '2026-11-06');
    await add('CENTAURO COM BR', -9999, '2026-09-29'); await add('CENTAURO COM BR', -9999, '2026-10-29');
    const list = new ListSubscriptionsUseCase(repos, () => NOW);

    expect((await list.execute({ userId: 'u1' })).monthlyInCents).toBe(4090 + 9999);

    await repos.ignoredSubscriptions.set('u1', 'CENTAURO', true);
    const after = await list.execute({ userId: 'u1' });
    expect(after.subscriptions.map((s) => s.key)).toEqual(['SPOTIFY']);
    expect(after.ignored.map((s) => s.key)).toEqual(['CENTAURO']);
    expect(after.monthlyInCents).toBe(4090);

    await repos.ignoredSubscriptions.set('u1', 'CENTAURO', false);
    expect((await list.execute({ userId: 'u1' })).ignored).toEqual([]);
  });
});

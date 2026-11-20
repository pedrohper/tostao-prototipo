import { beforeEach, describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import type { BankItemData } from '../gateways/bank-gateway.js';
import { BankConnectionError, ConflictError, ForbiddenError } from '../domain/errors.js';
import { SyncBankConnectionUseCase } from './sync-bank-connection.js';
import { ConnectBankUseCase } from './connect-bank.js';

const NOW = new Date(Date.UTC(2026, 10, 20, 18));
const ITEM = '3f1c2a9e-1b2c-4d5e-8f90-123456789abc';

/** Imita o Pluggy: o Item tem um dono (clientUserId) e pode ser de conector sandbox. */
class OwnedItemGateway extends FakeBankGateway {
  override readonly enforcesItemOwnership: boolean = true;
  override allowsSandbox = false;
  item: BankItemData = { institution: 'Banco de exemplo', clientUserId: 'u1', isSandbox: false };
  override async fetchItem(): Promise<BankItemData> {
    return this.item;
  }
}

describe('conectar banco (Open Finance): um Item é de uma pessoa só', () => {
  let repos: ReturnType<typeof makeInMemoryRepositories>;
  let bank: OwnedItemGateway;
  let connect: ConnectBankUseCase;

  beforeEach(() => {
    repos = makeInMemoryRepositories();
    bank = new OwnedItemGateway(() => NOW);
    const sync = new SyncBankConnectionUseCase({ ...repos, bank, now: () => NOW });
    connect = new ConnectBankUseCase(repos.connections, bank, sync);
  });

  it('o dono conecta, e conectar de novo só sincroniza (sem duplicar a conexão)', async () => {
    const first = await connect.execute({ userId: 'u1', itemId: ITEM });
    const again = await connect.execute({ userId: 'u1', itemId: ITEM });
    expect(again.connection.id).toBe(first.connection.id);
    expect(repos.connections.items).toHaveLength(1);
  });

  it('usuário B não conecta o Item que já é do usuário A (e o erro não diz de quem é)', async () => {
    await connect.execute({ userId: 'u1', itemId: ITEM });
    bank.item = { ...bank.item, clientUserId: 'u2' }; // mesmo com o clientUserId "certo", o Item já é de A

    const err = await connect.execute({ userId: 'u2', itemId: ITEM }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.message).not.toMatch(/u1/);
    expect(repos.connections.items.filter((c) => c.userId === 'u2')).toHaveLength(0);
  });

  it('usuário B não conecta um Item cujo clientUserId é de outra pessoa (Item ainda livre no banco)', async () => {
    bank.item = { ...bank.item, clientUserId: 'u1' };
    await expect(connect.execute({ userId: 'u2', itemId: ITEM })).rejects.toBeInstanceOf(ForbiddenError);
    expect(repos.connections.items).toHaveLength(0);
  });

  it('rejeita Item sem clientUserId (ex.: criado fora do nosso widget)', async () => {
    bank.item = { ...bank.item, clientUserId: null };
    await expect(connect.execute({ userId: 'u1', itemId: ITEM })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejeita Item sandbox quando o gateway não permite sandbox (produção)', async () => {
    bank.item = { ...bank.item, isSandbox: true };
    await expect(connect.execute({ userId: 'u1', itemId: ITEM })).rejects.toBeInstanceOf(BankConnectionError);
    expect(repos.connections.items).toHaveLength(0);
  });

  it('a trava do banco também vale: create de Item repetido entre usuários vira ConflictError', async () => {
    await repos.connections.create({ userId: 'u1', itemId: ITEM, institution: null });
    await expect(repos.connections.create({ userId: 'u2', itemId: ITEM, institution: null })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('import:/manual: continuam por usuário (dois usuários podem ter o mesmo)', async () => {
    await repos.connections.create({ userId: 'u1', itemId: 'import:nubank', institution: 'Nubank' });
    await repos.connections.create({ userId: 'u2', itemId: 'import:nubank', institution: 'Nubank' });
    await repos.connections.create({ userId: 'u1', itemId: 'manual:contas', institution: null });
    await repos.connections.create({ userId: 'u2', itemId: 'manual:contas', institution: null });
    expect(repos.connections.items).toHaveLength(4);
  });

  it('no gateway de exemplo (sem ownership) qualquer Item funciona, como antes', async () => {
    const fake = new FakeBankGateway(() => NOW);
    const sync = new SyncBankConnectionUseCase({ ...repos, bank: fake, now: () => NOW });
    const c = new ConnectBankUseCase(repos.connections, fake, sync);
    expect((await c.execute({ userId: 'u9', itemId: 'item-de-exemplo' })).connection.userId).toBe('u9');
  });
});

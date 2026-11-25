// T6.16 contra Postgres REAL (só com TEST_DATABASE_URL apontando pra um banco descartável com as migrations):
// a coluna `pix_key` grava, lê, apaga e some junto com a pessoa.
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExportUserDataUseCase } from '../../use-cases/export-user-data.js';
import { PixKeyUseCase } from '../../use-cases/pix-key.js';
import { makePrismaRepositories } from './index.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('T6.16 chave Pix no Postgres real', () => {
  let db: PrismaClient;
  let repos: ReturnType<typeof makePrismaRepositories>;
  beforeAll(() => {
    db = new PrismaClient({ datasourceUrl: url });
    repos = makePrismaRepositories(db);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('grava, lê, exporta, apaga e é eliminada com a conta', async () => {
    const user = await repos.users.create({
      name: 'Pessoa Pix',
      email: `pix-${randomUUID().slice(0, 8)}@x.com`,
      passwordHash: 'x',
    });
    expect(user.pixKey).toBeNull();
    const uc = new PixKeyUseCase(repos);

    expect(await uc.set({ userId: user.id, pixKey: '+5511912345678' })).toEqual({
      pixKey: '+5511912345678',
      type: 'telefone',
    });
    const { data } = await new ExportUserDataUseCase(repos).execute({ userId: user.id });
    expect(data.profile.pixKey).toBe('+5511912345678');

    expect(await uc.set({ userId: user.id, pixKey: null })).toEqual({ pixKey: null, type: null });
    await uc.set({ userId: user.id, pixKey: '52998224725' });
    await repos.users.delete(user.id);
    const left = await db.$queryRaw<unknown[]>`SELECT 1 FROM users WHERE id = ${user.id}`;
    expect(left).toHaveLength(0);
    await expect(uc.get({ userId: user.id })).rejects.toThrow();
  });
});

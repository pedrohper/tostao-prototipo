// T6.11 contra Postgres REAL (só com TEST_DATABASE_URL apontando pra um banco descartável com as migrations): a coluna
// JSON grava e lê, e dois aparelhos ao mesmo tempo não se atropelam (trava na linha da pessoa).
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExportUserDataUseCase } from '../../use-cases/export-user-data.js';
import { HomePrefsUseCase } from '../../use-cases/home-prefs.js';
import { makePrismaRepositories } from './index.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('T6.11 preferências da Home no Postgres real', () => {
  let db: PrismaClient;
  let repos: ReturnType<typeof makePrismaRepositories>;
  beforeAll(() => {
    db = new PrismaClient({ datasourceUrl: url });
    repos = makePrismaRepositories(db);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  const newUser = () =>
    repos.users.create({ name: 'Pessoa Home', email: `home-${randomUUID().slice(0, 8)}@x.com`, passwordHash: 'x' });

  it('grava, lê, exporta e é eliminada com a conta', async () => {
    const user = await newUser();
    expect(user.homePrefs).toBeNull();
    const uc = new HomePrefsUseCase(repos);
    expect(await uc.get({ userId: user.id })).toEqual({ prefs: null });

    const saved = await uc.update({ userId: user.id, patch: { layout: { ordem: ['aula'], ocultos: [] } } });
    expect(await uc.get({ userId: user.id })).toEqual(saved);
    const { data } = await new ExportUserDataUseCase(repos).execute({ userId: user.id });
    expect(data.profile.homePrefs).toEqual(saved.prefs);

    await repos.users.delete(user.id);
    await expect(uc.get({ userId: user.id })).rejects.toThrow();
    await expect(uc.update({ userId: user.id, patch: { fechar: ['a'] } })).rejects.toThrow();
  });

  it('muitos avisos fechados ao mesmo tempo: nenhum se perde', async () => {
    const user = await newUser();
    const uc = new HomePrefsUseCase(repos);
    const keys = Array.from({ length: 8 }, (_, i) => `aviso-${i}`);
    await Promise.all(keys.map((key) => uc.update({ userId: user.id, patch: { fechar: [key] } })));
    expect((await uc.get({ userId: user.id })).prefs?.fechados.sort()).toEqual(keys);
    await repos.users.delete(user.id);
  });

  it('dois cookies antigos subindo juntos: um vence inteiro, os avisos dos dois ficam', async () => {
    const user = await newUser();
    const uc = new HomePrefsUseCase(repos);
    const upload = (section: 'semana' | 'meta') =>
      uc.update({ userId: user.id, patch: { migrar: { ordem: [], ocultos: [section], fechados: [section] } } });
    const [first, second] = await Promise.all([upload('semana'), upload('meta')]);
    const { prefs } = await uc.get({ userId: user.id });
    expect(prefs?.ocultos).toHaveLength(1);
    expect(prefs?.fechados.sort()).toEqual(['meta', 'semana']);
    // Quem chegou depois já recebe a escolha vencedora na resposta.
    expect([first.prefs?.ocultos, second.prefs?.ocultos]).toContainEqual(prefs?.ocultos);
    expect(first.prefs?.ocultos).toEqual(second.prefs?.ocultos);
    await repos.users.delete(user.id);
  });
});

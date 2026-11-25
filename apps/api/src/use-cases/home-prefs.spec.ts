// T6.11 · preferências da Home na conta (use-case com repositório em memória).
import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { ExportUserDataUseCase } from './export-user-data.js';
import { HomePrefsUseCase } from './home-prefs.js';

async function setup() {
  const repos = makeInMemoryRepositories();
  const make = (email: string) => repos.users.create({ name: 'Pessoa', email, passwordHash: 'x' });
  return { repos, uc: new HomePrefsUseCase(repos), a: await make('a@x.com'), b: await make('b@x.com') };
}

describe('HomePrefsUseCase', () => {
  it('conta nova não tem nada guardado', async () => {
    const { uc, a } = await setup();
    expect(await uc.get({ userId: a.id })).toEqual({ prefs: null });
  });

  it('grava só na própria pessoa e devolve o mesmo na leitura', async () => {
    const { uc, a, b } = await setup();
    const saved = await uc.update({ userId: a.id, patch: { layout: { ordem: ['aula'], ocultos: ['meta'] } } });
    expect(saved).toEqual({ prefs: { ordem: ['aula'], ocultos: ['meta'], fechados: [], v: 2 } });
    expect(await uc.get({ userId: a.id })).toEqual(saved);
    expect(await uc.get({ userId: b.id })).toEqual({ prefs: null });
  });

  it('dois aparelhos subindo o cookie: o primeiro vence', async () => {
    const { uc, a } = await setup();
    await Promise.all([
      uc.update({ userId: a.id, patch: { migrar: { ordem: [], ocultos: ['semana'], fechados: ['p'] } } }),
      uc.update({ userId: a.id, patch: { migrar: { ordem: [], ocultos: ['meta'], fechados: ['c'] } } }),
    ]);
    const { prefs } = await uc.get({ userId: a.id });
    expect(prefs?.ocultos).toEqual(['semana']);
    expect(prefs?.fechados.sort()).toEqual(['c', 'p']);
  });

  it('valor antigo no banco (bloco que sumiu) é limpo na leitura', async () => {
    const { repos, uc, a } = await setup();
    repos.users.items.find((u) => u.id === a.id)!.homePrefs = { ordem: ['amigos', 'aula'], fechados: 'x' };
    expect(await uc.get({ userId: a.id })).toEqual({ prefs: { ordem: ['aula'], fechados: [] } });
  });

  it('pessoa que não existe: erro, sem criar nada', async () => {
    const { uc } = await setup();
    await expect(uc.get({ userId: 'ninguem' })).rejects.toThrow(/Conta/);
    await expect(uc.update({ userId: 'ninguem', patch: { fechar: ['a'] } })).rejects.toThrow(/Conta/);
  });

  it('entra no export LGPD', async () => {
    const { repos, uc, a } = await setup();
    const exporter = new ExportUserDataUseCase(repos);
    expect((await exporter.execute({ userId: a.id })).data.profile.homePrefs).toBeNull();
    await uc.update({ userId: a.id, patch: { fechar: ['dica:1'] } });
    expect((await exporter.execute({ userId: a.id })).data.profile.homePrefs).toEqual({
      ordem: [],
      fechados: ['dica:1'],
    });
  });
});

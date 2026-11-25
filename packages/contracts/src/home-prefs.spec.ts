// T6.11 · regra de mistura das preferências da Home (a mesma na API e na web) e validação do que entra.
import { describe, expect, it } from 'vitest';
import {
  HOME_SECTION_IDS,
  MAX_ALERT_KEY_LENGTH,
  MAX_DISMISSED_ALERTS,
  applyHomePrefsPatch,
  homePrefsPatchBody,
  readStoredHomePrefs,
  type StoredHomePrefs,
} from './home-prefs';

const phone: StoredHomePrefs = { ordem: [], ocultos: ['semana'], fechados: ['a'], v: 2 };
const computer: StoredHomePrefs = { ordem: [], ocultos: ['meta'], fechados: ['b'], v: 2 };
const onlyDismissed: StoredHomePrefs = { ordem: [], fechados: ['x'] };

describe('migrar o cookie antigo', () => {
  it('conta vazia recebe o que veio do aparelho', () => {
    expect(applyHomePrefsPatch(null, { migrar: phone })).toEqual(phone);
  });

  it('a conta vence: o segundo aparelho não passa por cima dos blocos, só soma os avisos fechados', () => {
    expect(applyHomePrefsPatch(phone, { migrar: computer })).toEqual({ ...phone, fechados: ['b', 'a'] });
  });

  it('aviso fechado não é personalização: a escolha de verdade de outro aparelho ainda entra', () => {
    const afterPhone = applyHomePrefsPatch(null, { migrar: onlyDismissed });
    expect(afterPhone.ocultos).toBeUndefined();
    expect(applyHomePrefsPatch(afterPhone, { migrar: computer })).toEqual({ ...computer, fechados: ['b', 'x'] });
  });

  it('cookie só com avisos nunca apaga a escolha guardada', () => {
    expect(applyHomePrefsPatch(phone, { migrar: onlyDismissed })).toEqual({ ...phone, fechados: ['x', 'a'] });
  });

  it('"nada escondido" é escolha e fica', () => {
    const everything: StoredHomePrefs = { ordem: [], ocultos: [], fechados: [] };
    const saved = applyHomePrefsPatch(null, { migrar: everything });
    expect(saved.ocultos).toEqual([]);
    expect(applyHomePrefsPatch(saved, { migrar: computer }).ocultos).toEqual([]);
  });
});

describe('mudanças da própria pessoa', () => {
  it('Personalizar troca os blocos e marca a escolha, sem mexer nos avisos', () => {
    const next = applyHomePrefsPatch(phone, { layout: { ordem: ['aula'], ocultos: [] } });
    expect(next).toEqual({ ordem: ['aula'], ocultos: [], fechados: ['a'], v: 2 });
  });

  it('fechar soma sem repetir, e restaurar limpa', () => {
    const twice = applyHomePrefsPatch(applyHomePrefsPatch(null, { fechar: ['a', 'a'] }), { fechar: ['b', 'a'] });
    expect(twice).toEqual({ ordem: [], fechados: ['b', 'a'] });
    expect(applyHomePrefsPatch(twice, { restaurarAvisos: true }).fechados).toEqual([]);
  });

  it('passando do teto, saem os avisos mais antigos', () => {
    const full = { ordem: [], fechados: Array.from({ length: MAX_DISMISSED_ALERTS }, (_, i) => `k${i}`) };
    const next = applyHomePrefsPatch(full, { fechar: ['novo'] });
    expect(next.fechados).toHaveLength(MAX_DISMISSED_ALERTS);
    expect(next.fechados[0]).toBe('k1');
    expect(next.fechados.at(-1)).toBe('novo');
  });

  it('ao subir o cookie antigo com a conta cheia, ficam os avisos que já estavam na conta', () => {
    const account = { ordem: [], fechados: Array.from({ length: MAX_DISMISSED_ALERTS }, (_, i) => `conta${i}`) };
    const next = applyHomePrefsPatch(account, { migrar: { ordem: [], fechados: ['antigo'] } });
    expect(next.fechados).toEqual(account.fechados);
  });
});

describe('homePrefsPatchBody', () => {
  const ok = (body: unknown) => homePrefsPatchBody.safeParse(body).success;

  it('aceita só blocos conhecidos, sem repetição', () => {
    expect(ok({ layout: { ordem: [...HOME_SECTION_IDS], ocultos: [] } })).toBe(true);
    expect(ok({ layout: { ordem: ['inventado'], ocultos: [] } })).toBe(false);
    expect(ok({ layout: { ordem: ['aula', 'aula'], ocultos: [] } })).toBe(false);
    expect(ok({ layout: { ordem: [] } })).toBe(false);
  });

  it('limita o tamanho dos avisos', () => {
    expect(ok({ fechar: ['a'.repeat(MAX_ALERT_KEY_LENGTH)] })).toBe(true);
    expect(ok({ fechar: ['a'.repeat(MAX_ALERT_KEY_LENGTH + 1)] })).toBe(false);
    expect(ok({ fechar: [''] })).toBe(false);
    expect(ok({ fechar: Array.from({ length: MAX_DISMISSED_ALERTS + 1 }, (_, i) => `${i}`) })).toBe(false);
  });

  it('recusa corpo vazio e campo estranho', () => {
    expect(ok({})).toBe(false);
    expect(ok({ fechar: ['a'], userId: 'outra-pessoa' })).toBe(false);
    expect(ok({ migrar: { ordem: [], fechados: [], extra: 'x' } })).toBe(false);
    expect(ok({ restaurarAvisos: false })).toBe(false);
  });
});

describe('readStoredHomePrefs', () => {
  it('descarta bloco que deixou de existir e valores estranhos, mantendo o resto', () => {
    const raw = { ordem: ['amigos', 'aula', 'aula'], ocultos: ['missoes', 'semana', 7], fechados: ['a', 3, ''], v: 9 };
    expect(readStoredHomePrefs(raw)).toEqual({ ordem: ['aula'], ocultos: ['semana'], fechados: ['a'] });
  });

  it('devolve null quando não há objeto', () => {
    for (const raw of [null, undefined, 'x', 3, []]) expect(readStoredHomePrefs(raw)).toBeNull();
  });
});

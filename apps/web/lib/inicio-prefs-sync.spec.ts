// T6.11 · preferências da Home na conta: o que aparece na tela, a subida do cookie antigo e o que acontece com a API fora.
import { applyHomePrefsPatch, type HomePrefsPatch, type StoredHomePrefs } from '@tostao/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  account: null as unknown,
  apiDown: false,
  calls: [] as { path: string; method: string; body?: unknown }[],
  toasts: [] as string[],
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { value: state.jar.get(name)! } : undefined),
    set: (name: string, value: string) => void state.jar.set(name, value),
    delete: (name: string) => void state.jar.delete(name),
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('./session', () => ({
  getToken: async () => `x.${Buffer.from('{"sub":"pessoa-1"}').toString('base64url')}.y`,
}));
vi.mock('./flash-toast-server', () => ({ flashToast: async (message: string) => void state.toasts.push(message) }));
vi.mock('./api', () => ({
  api: async (path: string, init: { method?: string; body?: unknown } = {}) => {
    state.calls.push({ path, method: init.method ?? 'GET', body: init.body });
    if (state.apiDown) throw new Error('API fora');
    if (init.method === 'PATCH') {
      state.account = applyHomePrefsPatch(state.account as StoredHomePrefs | null, init.body as HomePrefsPatch);
    }
    return { prefs: state.account };
  },
}));

import { dismissAlert, restoreDismissedAlerts, saveHomePrefs, syncHomePrefs } from './inicio-actions';
import {
  DEFAULT_HIDDEN_SECTIONS,
  PREFS_COOKIE,
  cacheCookie,
  legacyCookiePrefs,
  resolveHomePrefs,
} from './inicio-prefs';

const USER = 'pessoa-1';
const choice: StoredHomePrefs = { ordem: [], ocultos: ['semana'], fechados: ['dica:1'], v: 2 };
const legacy = JSON.stringify(choice);
const cookie = () => state.jar.get(PREFS_COOKIE);
const view = (remote: StoredHomePrefs | null | 'down', raw?: string) =>
  resolveHomePrefs({ remote: remote === 'down' ? undefined : { prefs: remote }, cookie: raw, userId: USER });

beforeEach(() => {
  state.jar.clear();
  state.account = null;
  state.apiDown = false;
  state.calls = [];
  state.toasts = [];
});

describe('legacyCookiePrefs()', () => {
  it('padrão antigo congelado ao fechar um aviso sobe só o aviso', () => {
    const frozen = JSON.stringify({ ordem: [], ocultos: ['vence', 'semana', 'acertos', 'cartoes'], fechados: ['a'] });
    expect(legacyCookiePrefs(frozen)).toEqual({ ordem: [], fechados: ['a'] });
  });

  it('bloco que não existe mais é descartado sem perder a escolha', () => {
    const old = JSON.stringify({ ocultos: ['missoes', 'semana'], ordem: ['amigos', 'aula'] });
    expect(legacyCookiePrefs(old)).toEqual({ ordem: ['aula'], ocultos: ['semana'], fechados: [] });
  });

  it('sem nada de útil, ou já sendo cópia da conta, não há o que subir', () => {
    for (const raw of [undefined, '', '{}', '{lixo', 'null', cacheCookie(choice, USER)]) {
      expect(legacyCookiePrefs(raw), String(raw)).toBeNull();
    }
  });
});

describe('o que a Home mostra (resolveHomePrefs)', () => {
  it('conta vazia + cookie antigo: mostra o cookie e pede pra subir', () => {
    const { prefs, needsSync } = view(null, legacy);
    expect(prefs.ocultos).toEqual(['semana']);
    expect(prefs.fechados).toEqual(['dica:1']);
    expect(needsSync).toBe(true);
  });

  it('a conta vence um cookie antigo com outra escolha', () => {
    const account: StoredHomePrefs = { ordem: [], ocultos: ['meta'], fechados: [], v: 2 };
    expect(view(account, legacy).prefs.ocultos).toEqual(['meta']);
  });

  it('conta só com aviso fechado + escolha antiga no aparelho: vale a escolha', () => {
    const { prefs } = view({ ordem: [], fechados: ['outro'] }, legacy);
    expect(prefs.ocultos).toEqual(['semana']);
    expect(prefs.fechados).toEqual(['dica:1', 'outro']);
  });

  it('conta sem escolha de blocos segue o padrão enxuto', () => {
    expect(view({ ordem: [], fechados: ['a'] }).prefs.ocultos).toEqual([...DEFAULT_HIDDEN_SECTIONS]);
    expect(view(null).prefs.ocultos).toEqual([...DEFAULT_HIDDEN_SECTIONS]);
    expect(view(null).needsSync).toBe(false);
  });

  it('cópia em dia não pede nada; cópia velha pede atualização', () => {
    expect(view(choice, cacheCookie(choice, USER)).needsSync).toBe(false);
    expect(view({ ...choice, ocultos: ['meta'] }, cacheCookie(choice, USER)).needsSync).toBe(true);
    expect(view(choice).needsSync).toBe(true);
  });

  it('API fora: vale a cópia (ou o cookie antigo) e nada é enviado', () => {
    for (const raw of [cacheCookie(choice, USER), legacy]) {
      const { prefs, needsSync } = view('down', raw);
      expect(prefs.ocultos).toEqual(['semana']);
      expect(needsSync).toBe(false);
    }
    expect(view('down').prefs.ocultos).toEqual([...DEFAULT_HIDDEN_SECTIONS]);
  });

  it('cópia de outra conta no mesmo aparelho é ignorada', () => {
    const other = cacheCookie(choice, 'pessoa-2');
    expect(view(null, other).prefs.ocultos).toEqual([...DEFAULT_HIDDEN_SECTIONS]);
    expect(view('down', other).prefs.fechados).toEqual([]);
  });

  it('a cópia cabe no cookie: com muitos avisos longos, saem os mais antigos', () => {
    const many = Array.from({ length: 80 }, (_, i) => `${i}:${'x'.repeat(100)}`);
    const value = cacheCookie({ ordem: [], fechados: many }, USER);
    expect(encodeURIComponent(value).length).toBeLessThanOrEqual(3500);
    expect(JSON.parse(value).fechados.at(-1)).toBe(many.at(-1));
  });
});

describe('Server Actions', () => {
  it('primeiro acesso: sobe o cookie, troca por uma cópia carimbada e não sobe de novo', async () => {
    state.jar.set(PREFS_COOKIE, legacy);
    await syncHomePrefs();
    expect(state.calls).toEqual([{ path: '/me/home-prefs', method: 'PATCH', body: { migrar: choice } }]);
    expect(state.account).toEqual(choice);
    expect(JSON.parse(cookie()!)).toEqual({ ...choice, dono: USER });

    await syncHomePrefs();
    expect(state.calls.at(-1)).toEqual({ path: '/me/home-prefs', method: 'GET', body: undefined });
  });

  it('segundo aparelho: a conta já tem escolha, que vence e volta pra cópia local', async () => {
    state.account = { ordem: [], ocultos: ['meta'], fechados: [], v: 2 };
    state.jar.set(PREFS_COOKIE, legacy);
    await syncHomePrefs();
    expect(JSON.parse(cookie()!)).toMatchObject({ ocultos: ['meta'], fechados: ['dica:1'], dono: USER });
  });

  it('API fora: o cookie antigo fica intacto pra próxima visita', async () => {
    state.jar.set(PREFS_COOKIE, legacy);
    state.apiDown = true;
    await syncHomePrefs();
    expect(cookie()).toBe(legacy);
  });

  it('fechar um aviso antes de a subida terminar manda as duas coisas juntas', async () => {
    state.jar.set(PREFS_COOKIE, legacy);
    await dismissAlert('novo');
    expect(state.calls[0]!.body).toEqual({ migrar: choice, fechar: ['novo'] });
    expect((state.account as StoredHomePrefs).fechados).toEqual(['dica:1', 'novo']);
  });

  it('restaurar avisos antes da subida não deixa o cookie antigo trazê-los de volta', async () => {
    state.jar.set(PREFS_COOKIE, legacy);
    await restoreDismissedAlerts();
    expect(state.account).toEqual({ ...choice, fechados: [] });
  });

  it('API fora ao fechar um aviso: avisa a pessoa, sem lançar erro nem mexer no cookie', async () => {
    state.jar.set(PREFS_COOKIE, legacy);
    state.apiDown = true;
    await expect(dismissAlert('novo')).resolves.toBeUndefined();
    expect(state.toasts).toHaveLength(1);
    expect(cookie()).toBe(legacy);
  });

  it('salvar no Personalizar grava na conta e redireciona pra Home', async () => {
    await expect(saveHomePrefs(['aula', 'inventado'], ['semana'])).rejects.toMatchObject({
      digest: expect.stringContaining('/inicio'),
    });
    expect(state.account).toEqual({ ordem: ['aula'], ocultos: ['semana'], fechados: [], v: 2 });
  });

  it('salvar com a API fora devolve o erro pra tela, sem redirecionar', async () => {
    state.apiDown = true;
    await expect(saveHomePrefs(['aula'], [])).resolves.toMatchObject({ error: expect.stringContaining('salvar') });
  });
});

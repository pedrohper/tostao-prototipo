// T4.1 · estado do toast global (o que o ToastProvider usa): variantes, "Desfazer", limite na tela e expiração.
import { describe, expect, it } from 'vitest';
import { createToast, MAX_TOASTS, toastReducer, toastRole, type Toast } from './toast-state';

const make = (message: string, extra: Partial<Parameters<typeof createToast>[0]> = {}, id = message): Toast =>
  createToast({ message, ...extra }, id);

describe('createToast()', () => {
  it('padrão é "success" e cada variante tem a sua duração (erro dura mais)', () => {
    expect(make('Salvo').variant).toBe('success');
    const ok = make('a', { variant: 'success' }).durationMs;
    const info = make('b', { variant: 'info' }).durationMs;
    const err = make('c', { variant: 'error' }).durationMs;
    expect(err).toBeGreaterThan(ok);
    expect(info).toBeGreaterThanOrEqual(ok);
  });

  it('toast com ação ("Desfazer") dura mais que o simples, pra dar tempo de tocar', () => {
    const plain = make('Apagado');
    const withUndo = make('Apagado', { actionLabel: 'Desfazer', onAction: () => {} });
    expect(withUndo.actionLabel).toBe('Desfazer');
    expect(withUndo.durationMs).toBeGreaterThan(plain.durationMs);
  });

  it('só guarda a ação quando tem rótulo E callback (botão sem efeito não aparece)', () => {
    expect(make('x', { actionLabel: 'Desfazer' }).actionLabel).toBeUndefined();
    expect(make('x', { onAction: () => {} }).onAction).toBeUndefined();
  });

  it('respeita a duração pedida', () => {
    expect(make('x', { durationMs: 123 }).durationMs).toBe(123);
  });
});

describe('toastReducer()', () => {
  it('add empilha na ordem e dismiss tira só o pedido', () => {
    let state: Toast[] = [];
    state = toastReducer(state, { type: 'add', toast: make('um') });
    state = toastReducer(state, { type: 'add', toast: make('dois') });
    expect(state.map((t) => t.message)).toEqual(['um', 'dois']);
    state = toastReducer(state, { type: 'dismiss', id: 'um' });
    expect(state.map((t) => t.message)).toEqual(['dois']);
  });

  it('dismiss de id que não existe devolve o MESMO array (sem re-render à toa)', () => {
    const state = [make('um')];
    expect(toastReducer(state, { type: 'dismiss', id: 'nada' })).toBe(state);
  });

  it(`mantém no máximo ${MAX_TOASTS} na tela: os mais antigos saem`, () => {
    let state: Toast[] = [];
    for (const m of ['a', 'b', 'c', 'd', 'e']) state = toastReducer(state, { type: 'add', toast: make(m) });
    expect(state).toHaveLength(MAX_TOASTS);
    expect(state.map((t) => t.message)).toEqual(['c', 'd', 'e']);
  });

  it('mesma mensagem e variante não empilha: troca pelo mais novo (e vai pro fim)', () => {
    let state: Toast[] = [];
    state = toastReducer(state, { type: 'add', toast: make('Salvo', {}, 't1') });
    state = toastReducer(state, { type: 'add', toast: make('Outro', {}, 't2') });
    state = toastReducer(state, { type: 'add', toast: make('Salvo', {}, 't3') });
    expect(state.map((t) => t.id)).toEqual(['t2', 't3']);
  });

  it('mesma mensagem com variante diferente convive (erro e sucesso são avisos diferentes)', () => {
    let state: Toast[] = [];
    state = toastReducer(state, { type: 'add', toast: make('Salvo', { variant: 'success' }, 't1') });
    state = toastReducer(state, { type: 'add', toast: make('Salvo', { variant: 'error' }, 't2') });
    expect(state).toHaveLength(2);
  });

  it('clear esvazia (e não troca a referência se já estava vazio)', () => {
    const empty: Toast[] = [];
    expect(toastReducer(empty, { type: 'clear' })).toBe(empty);
    expect(toastReducer([make('a')], { type: 'clear' })).toEqual([]);
  });
});

describe('toastRole()', () => {
  it('erro interrompe o leitor de tela (alert); o resto espera a vez (status)', () => {
    expect(toastRole('error')).toBe('alert');
    expect(toastRole('success')).toBe('status');
    expect(toastRole('info')).toBe('status');
  });
});

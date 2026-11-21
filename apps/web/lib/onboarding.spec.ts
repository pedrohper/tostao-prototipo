// T4.2 · fluxo de onboarding: quando esconder a Nav, quem pode avançar sem salário e o checklist da Home vazia.
import { describe, expect, it } from 'vitest';
import {
  activationChecklist,
  canAdvanceIncome,
  isOnboardingActive,
  onboardingProgress,
  onboardingStep,
  ONBOARDING_TOTAL_STEPS,
} from './onboarding';

describe('isOnboardingActive() · Nav some só nos passos com ?novo=1', () => {
  it('/conectar e /renda com novo=1 são onboarding', () => {
    expect(isOnboardingActive('/conectar', '1')).toBe(true);
    expect(isOnboardingActive('/renda', '1')).toBe(true);
  });

  it('sem novo=1 a Nav continua (uso normal dessas telas)', () => {
    expect(isOnboardingActive('/conectar', null)).toBe(false);
    expect(isOnboardingActive('/renda', undefined)).toBe(false);
    expect(isOnboardingActive('/renda', '0')).toBe(false);
    expect(isOnboardingActive('/renda', 'true')).toBe(false);
  });

  it('/meta?novo=1 é "nova meta" (vem da Home), não onboarding: a Nav fica', () => {
    expect(isOnboardingActive('/meta', '1')).toBe(false);
    expect(isOnboardingActive('/inicio', '1')).toBe(false);
  });

  it('tolera barra final e query colada no pathname; não confunde prefixos', () => {
    expect(isOnboardingActive('/renda/', '1')).toBe(true);
    expect(isOnboardingActive('/conectar?novo=1', '1')).toBe(true);
    expect(isOnboardingActive('/rendas', '1')).toBe(false);
    expect(isOnboardingActive('/conectar/outra', '1')).toBe(false);
    expect(isOnboardingActive(null, '1')).toBe(false);
  });
});

describe('onboardingStep() / onboardingProgress()', () => {
  it('conectar é o passo 2 e renda o 3 (o cadastro foi o 1)', () => {
    expect(onboardingStep('/conectar')).toBe(2);
    expect(onboardingStep('/renda')).toBe(3);
  });

  it('progresso em porcentagem e travado entre 1 e o total', () => {
    expect(onboardingProgress(1)).toEqual({ step: 1, total: ONBOARDING_TOTAL_STEPS, percent: 33 });
    expect(onboardingProgress(3).percent).toBe(100);
    expect(onboardingProgress(0).step).toBe(1);
    expect(onboardingProgress(99).step).toBe(ONBOARDING_TOTAL_STEPS);
  });
});

describe('canAdvanceIncome() · /renda?novo=1 avança mesmo sem salário fixo', () => {
  const none = { salaryCents: null, deferIncome: false, otherIncomesCents: 0 };

  it('com salário sempre avança', () => {
    expect(canAdvanceIncome({ novo: true, ...none, salaryCents: 300_000 })).toBe(true);
    expect(canAdvanceIncome({ novo: false, ...none, salaryCents: 300_000 })).toBe(true);
  });

  it('onboarding sem nada preenchido ainda trava (precisa escolher um caminho)', () => {
    expect(canAdvanceIncome({ novo: true, ...none })).toBe(false);
  });

  it('"Minha renda varia / prefiro preencher depois" libera', () => {
    expect(canAdvanceIncome({ novo: true, ...none, deferIncome: true })).toBe(true);
  });

  it('qualquer outra entrada (bolsa, freela, mesada) libera, sem salário', () => {
    expect(canAdvanceIncome({ novo: true, ...none, otherIncomesCents: 80_000 })).toBe(true);
  });

  it('fora do onboarding a regra antiga continua: sem salário não avança, nem com "depois"', () => {
    expect(canAdvanceIncome({ novo: false, ...none, deferIncome: true })).toBe(false);
    expect(canAdvanceIncome({ novo: false, ...none, otherIncomesCents: 80_000 })).toBe(false);
  });

  it('salário 0 conta como sem salário', () => {
    expect(canAdvanceIncome({ novo: true, salaryCents: 0, deferIncome: false, otherIncomesCents: 0 })).toBe(false);
    expect(canAdvanceIncome({ novo: true, salaryCents: 0, deferIncome: true, otherIncomesCents: 0 })).toBe(true);
  });
});

describe('activationChecklist() · Home de primeiros passos', () => {
  const empty = { hasConnection: false, hasTransactions: false, hasGoal: false, lessonsDone: 0 };

  it('conta nova: 4 passos, nenhum feito, cada um com o link da tela onde acontece', () => {
    const r = activationChecklist(empty);
    expect(r.total).toBe(4);
    expect(r.doneCount).toBe(0);
    expect(r.allDone).toBe(false);
    expect(r.items.map((i) => i.id)).toEqual(['conectar', 'anotar', 'meta', 'licao']);
    expect(r.items.find((i) => i.id === 'anotar')?.href).toBe('/anotar');
  });

  it('quem já definiu a meta no onboarding vê o passo "meta" feito (nada some nem se perde)', () => {
    const r = activationChecklist({ ...empty, hasGoal: true });
    expect(r.items.find((i) => i.id === 'meta')?.done).toBe(true);
    expect(r.doneCount).toBe(1);
  });

  it('aula feita e banco conectado contam; tudo feito marca allDone', () => {
    const r = activationChecklist({ hasConnection: true, hasTransactions: true, hasGoal: true, lessonsDone: 2 });
    expect(r.doneCount).toBe(4);
    expect(r.allDone).toBe(true);
  });

  it('a 1ª lição aponta pra lição de verdade quando o link é informado', () => {
    const r = activationChecklist({ ...empty, firstLessonHref: '/aprender/m1-l1' });
    expect(r.items.find((i) => i.id === 'licao')?.href).toBe('/aprender/m1-l1');
    expect(activationChecklist(empty).items.find((i) => i.id === 'licao')?.href).toBe('/aprender');
  });
});

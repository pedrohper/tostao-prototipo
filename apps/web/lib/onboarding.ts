// Regras do onboarding guiado (T4.2), sem React/Next: o shell, a renda e a Home só consultam estas funções.

/** Telas que formam o passo a passo quando abertas com `?novo=1`. (`/meta?novo=1` é "nova meta" fora do onboarding.) */
const ONBOARDING_PATHS = ['/conectar', '/renda'] as const;

/** O cadastro é o passo 1; depois vêm conectar (2) e renda/meta (3). */
export const ONBOARDING_TOTAL_STEPS = 3;

function normalize(pathname: string | null | undefined): string {
  const path = (pathname ?? '').split(/[?#]/)[0] ?? '';
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** `novo` pode vir de URLSearchParams.get('novo') (string|null) ou do searchParams do servidor. */
export function isOnboardingActive(pathname: string | null | undefined, novo: string | null | undefined): boolean {
  if (novo !== '1') return false;
  return (ONBOARDING_PATHS as readonly string[]).includes(normalize(pathname));
}

export function onboardingStep(pathname: string | null | undefined): number {
  return normalize(pathname) === '/renda' ? 3 : 2;
}

export function onboardingProgress(step: number): { step: number; total: number; percent: number } {
  const clamped = Math.min(ONBOARDING_TOTAL_STEPS, Math.max(1, Math.round(step)));
  return {
    step: clamped,
    total: ONBOARDING_TOTAL_STEPS,
    percent: Math.round((clamped / ONBOARDING_TOTAL_STEPS) * 100),
  };
}

/**
 * "Continuar" na renda. Fora do onboarding vale a regra antiga (precisa de salário). Com `novo=1`, autônomo, estudante
 * e quem tem renda variável avançam: basta escolher "prefiro preencher depois" ou ter qualquer outra entrada.
 */
export function canAdvanceIncome(input: {
  novo: boolean;
  salaryCents: number | null;
  deferIncome: boolean;
  otherIncomesCents: number;
}): boolean {
  if ((input.salaryCents ?? 0) > 0) return true;
  if (!input.novo) return false;
  return input.deferIncome || input.otherIncomesCents > 0;
}

export type ChecklistItemId = 'conectar' | 'anotar' | 'meta' | 'licao';
export type ChecklistItem = { id: ChecklistItemId; done: boolean; href: string };

/** Checklist de ativação da Home vazia: quatro primeiros passos, cada um com o lugar onde ele acontece. */
export function activationChecklist(input: {
  hasConnection: boolean;
  hasTransactions: boolean;
  hasGoal: boolean;
  lessonsDone: number;
  firstLessonHref?: string;
}): { items: ChecklistItem[]; doneCount: number; total: number; allDone: boolean } {
  const items: ChecklistItem[] = [
    { id: 'conectar', done: input.hasConnection, href: '/conectar?voltar=/inicio' },
    { id: 'anotar', done: input.hasTransactions, href: '/anotar' },
    { id: 'meta', done: input.hasGoal, href: '/meta?voltar=/inicio' },
    { id: 'licao', done: input.lessonsDone > 0, href: input.firstLessonHref ?? '/aprender' },
  ];
  const doneCount = items.filter((i) => i.done).length;
  return { items, doneCount, total: items.length, allDone: doneCount === items.length };
}

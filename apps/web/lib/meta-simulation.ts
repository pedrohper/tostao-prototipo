// Presets e simulação ao vivo da tela de meta (T4.2). Sem Next/React: dá pra testar direto.

export type GoalKind = 'reserva' | 'viagem' | 'sair-do-vermelho' | 'outro';

export type GoalPresetId = 'reserva-3-meses' | 'quitar-cartao' | 'viagem' | 'equipamento';

export type GoalPreset = {
  id: GoalPresetId;
  kind: GoalKind;
  /** Valor inicial sugerido (a pessoa ajusta). */
  amountInCents: number;
  /** Quanto guardar por mês pra bater o prazo sugerido. */
  monthlyInCents: number;
};

export const GOAL_PRESETS: readonly GoalPreset[] = [
  { id: 'reserva-3-meses', kind: 'reserva', amountInCents: 300_000, monthlyInCents: 50_000 },
  { id: 'quitar-cartao', kind: 'sair-do-vermelho', amountInCents: 150_000, monthlyInCents: 30_000 },
  { id: 'viagem', kind: 'viagem', amountInCents: 200_000, monthlyInCents: 25_000 },
  { id: 'equipamento', kind: 'outro', amountInCents: 400_000, monthlyInCents: 40_000 },
];

export const MONTHLY_CHIPS_IN_CENTS = [10_000, 20_000, 30_000, 50_000] as const;

/** Passa disso a projeção deixa de ser útil ("daqui a 83 anos"). */
export const MAX_PROJECTION_MONTHS = 600;

/** Meses até juntar `targetCents` guardando `monthlyCents` por mês. 0 = já bateu; null = não dá pra calcular. */
export function monthsToReach(input: {
  targetCents: number;
  monthlyCents: number;
  savedCents?: number;
}): number | null {
  const { targetCents, monthlyCents, savedCents = 0 } = input;
  if (!Number.isFinite(targetCents) || !Number.isFinite(monthlyCents) || targetCents <= 0) return null;
  const left = targetCents - Math.max(0, savedCents);
  if (left <= 0) return 0;
  if (monthlyCents <= 0) return null;
  const months = Math.ceil(left / monthlyCents);
  return months > MAX_PROJECTION_MONTHS ? null : months;
}

/** Mês (AAAA-MM) em que a meta bate, contando o mês atual como o primeiro depósito. `now` entra pra ser testável. */
export function projectedMonth(now: Date, months: number): string {
  const total = now.getFullYear() * 12 + now.getMonth() + Math.max(0, months - 1);
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** "dez/2026". `monthNames` vem do dicionário (12 nomes, de janeiro a dezembro). */
export function projectionLabel(yearMonth: string, monthNames: readonly string[]): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yearMonth);
  if (!match) return '';
  const name = (monthNames[Number(match[2]) - 1] ?? '').slice(0, 3).toLowerCase();
  return `${name}/${match[1]}`;
}

/** Quanto guardar por mês pra bater a meta até `deadline` (AAAA-MM), ou null se o prazo já passou/for inválido. */
export function monthlyNeeded(input: {
  targetCents: number;
  deadline: string;
  now: Date;
  savedCents?: number;
}): number | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(input.deadline);
  if (!match || input.targetCents <= 0) return null;
  const monthsLeft =
    (Number(match[1]) - input.now.getFullYear()) * 12 + (Number(match[2]) - 1 - input.now.getMonth()) + 1;
  if (monthsLeft < 1) return null;
  const left = input.targetCents - Math.max(0, input.savedCents ?? 0);
  return left <= 0 ? 0 : Math.ceil(left / monthsLeft);
}

// T4.3 · Home: os "Avisos" e o quadro de achados do Tostão diziam a mesma coisa duas vezes (pendentes, limite
// estourado). Aqui se decide o que aparece, no máximo 2 cartões, sem repetir. Puro: o Home só renderiza o resultado.

export const MAX_HOME_ALERTS = 2;

export type InsightLike = { id: string; kind: string; severity?: string };

/** Avisos locais da Home (calculados a partir do resumo) e qual achado do Tostão já cobre cada um. */
export type LocalAlertKey = 'overBudget' | 'uncategorized' | 'deliveryTip' | 'monthlyClosing' | 'subscriptions';

/** Achado do Tostão que torna o aviso local redundante (mesma informação, mesma ação). */
export const LOCAL_ALERT_COVERED_BY: Partial<Record<LocalAlertKey, string>> = {
  overBudget: 'budget_alert',
  uncategorized: 'uncategorized_batch',
};

// Menor número = aparece primeiro. Dinheiro estourando vem antes de dica e de rotina.
const LOCAL_PRIORITY: Record<LocalAlertKey, number> = {
  overBudget: 10,
  uncategorized: 20,
  deliveryTip: 40,
  monthlyClosing: 50,
  subscriptions: 60,
};
const INSIGHT_SEVERITY_PRIORITY: Record<string, number> = { urgent: 5, warning: 15, info: 30 };
const insightPriority = (i: InsightLike) => INSIGHT_SEVERITY_PRIORITY[i.severity ?? 'info'] ?? 30;

export type UnifiedAlerts = {
  /** Achados do Tostão a mostrar (ordem de prioridade). */
  insights: InsightLike[];
  /** Avisos locais a mostrar. */
  local: LocalAlertKey[];
};

export function unifyAlerts<T extends InsightLike>(input: {
  insights: T[];
  /** Avisos locais que existem agora (já filtrados por "dispensado"). */
  local: LocalAlertKey[];
  max?: number;
}): { insights: T[]; local: LocalAlertKey[] } {
  const max = input.max ?? MAX_HOME_ALERTS;
  const insightKinds = new Set(input.insights.map((i) => i.kind));

  type Candidate = { priority: number; order: number } & ({ insight: T } | { local: LocalAlertKey });
  const candidates: Candidate[] = [];
  input.insights.forEach((insight, order) => candidates.push({ insight, priority: insightPriority(insight), order }));
  input.local.forEach((local, i) => {
    const coveredBy = LOCAL_ALERT_COVERED_BY[local];
    if (coveredBy && insightKinds.has(coveredBy)) return; // o achado já diz isso: o aviso local seria repetição
    candidates.push({ local, priority: LOCAL_PRIORITY[local], order: 1000 + i });
  });
  candidates.sort((a, b) => a.priority - b.priority || a.order - b.order);

  const picked = candidates.slice(0, Math.max(0, max));
  return {
    insights: picked.flatMap((c) => ('insight' in c ? [c.insight] : [])),
    local: picked.flatMap((c) => ('local' in c ? [c.local] : [])),
  };
}

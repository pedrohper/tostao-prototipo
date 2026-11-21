// Quando um achado do Tostão Auto que já foi resolvido volta a valer (reabre como PENDING)?
// Uma regra só, usada pelo repositório do Postgres e pelo em memória.

/** Achados de condição mensal: se a pessoa voltar a estourar depois de ter resolvido, o aviso precisa voltar. */
export const MONTHLY_INSIGHT_KINDS = new Set(['month_shortfall', 'next_month_tight', 'budget_alert', 'goal_off_track']);

export type ReopenCandidate = {
  status: string;
  payload: Record<string, unknown>;
};

/**
 * - Mensal (sem ação "aplicar", só some quando a condição passa): APPLIED = a condição passou. Se voltou, reabre.
 *   DISMISSED (a pessoa mandou calar) nunca reabre.
 * - `uncategorized_batch`: reabre só se chegou transação NOVA sem categoria (a mais nova ficou mais nova que a do
 *   aviso anterior). Categorizar a mais recente faz a "mais nova pendente" ser uma ANTIGA: isso não é pendência nova.
 */
export function shouldReopenInsight(
  existing: ReopenCandidate,
  data: { kind: string; payload: Record<string, unknown> },
): boolean {
  if (existing.status !== 'APPLIED') return false;
  if (MONTHLY_INSIGHT_KINDS.has(data.kind)) return true;
  if (data.kind !== 'uncategorized_batch') return false;
  const nextAt = data.payload.latestCreatedAt;
  const prevAt = existing.payload.latestCreatedAt;
  if (typeof nextAt === 'string' && typeof prevAt === 'string') return nextAt > prevAt;
  // Aviso antigo, sem a data: cai na comparação que existia (id da mais nova).
  return typeof data.payload.latestTxId === 'string' && data.payload.latestTxId !== existing.payload.latestTxId;
}

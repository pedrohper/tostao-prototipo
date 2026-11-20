import type { Repositories } from '../repositories/types.js';
import { findManualDuplicates, MATCH_WINDOW_DAYS } from '../services/reconcile-manual.js';

const DAY = 24 * 60 * 60 * 1000;
/** Quanto do passado olhar depois do sync: cobre a anotação feita depois que o banco já tinha trazido a cobrança. */
export const SYNC_LOOKBACK_DAYS = 35;

/**
 * Depois de cada sync: se uma cobrança que o banco trouxe já tinha sido anotada à mão,
 * apaga a anotação (a cobrança real vale mais) e passa o que a pessoa tinha escrito pra ela.
 * Só age em par seguro (1 anotação ↔ 1 cobrança); o que for ambíguo continua como está.
 */
export async function reconcileManualEntries(
  { transactions, tx }: Pick<Repositories, 'transactions' | 'reconciledNotes' | 'tx'>,
  userId: string,
  range: { from: Date; to: Date },
  hiddenAccountIds: ReadonlySet<string> = new Set(),
): Promise<{ removedCount: number; ambiguousCount: number }> {
  // Folga dos dois lados: a anotada pode estar até MATCH_WINDOW_DAYS longe da cobrança.
  const margin = (MATCH_WINDOW_DAYS + 1) * DAY;
  const window = await transactions.findManyInRange(
    userId,
    new Date(range.from.getTime() - margin),
    new Date(range.to.getTime() + margin),
  );
  const { matched, ambiguous } = findManualDuplicates(window, hiddenAccountIds);

  // Tudo ou nada: se algo falhar no meio, nenhuma anotação some sem o histórico correspondente (e vice-versa).
  await tx(async (r) => {
    for (const { manual, bank } of matched) {
      const inherit = {
        ...(!bank.note && manual.note ? { note: manual.note } : {}),
        ...(!bank.categoryId && manual.categoryId ? { categoryId: manual.categoryId } : {}),
      };
      if (Object.keys(inherit).length > 0) await r.transactions.save({ ...bank, ...inherit });
      // Guarda o histórico antes de apagar: a pessoa vê em /anotacoes o que o app removeu e por quê.
      await r.reconciledNotes.create({
        userId,
        description: manual.description,
        amountInCents: manual.amountInCents,
        occurredAt: manual.occurredAt,
        categoryId: manual.categoryId,
        note: manual.note ?? null,
        bankTransactionId: bank.id,
        bankDescription: bank.description,
      });
      await r.transactions.delete(manual.id);
    }
  });
  return { removedCount: matched.length, ambiguousCount: ambiguous.length };
}

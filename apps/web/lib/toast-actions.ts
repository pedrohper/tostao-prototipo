'use server';
import { api } from '@/lib/api';
import { parseFlashUndo } from '@/lib/flash-toast';
import { revalidateFinance } from '@/lib/revalidate';
import { rethrowIfRedirect } from '@/lib/rethrow';

/** "Desfazer" de um toast vindo de redirect(): refaz o contrário usando só endpoints que já existem. */
export async function undoFlashAction(raw: unknown): Promise<{ ok: boolean }> {
  const undo = parseFlashUndo(raw);
  if (!undo) return { ok: false };
  try {
    if (undo.kind === 'categorize') {
      await api(`/transactions/${undo.id}/category`, {
        method: 'PATCH',
        body: { categoryId: undo.categoryId, remember: false },
      });
    }
  } catch (caught) {
    rethrowIfRedirect(caught);
    return { ok: false };
  }
  revalidateFinance();
  return { ok: true };
}

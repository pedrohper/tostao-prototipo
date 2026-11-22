'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { CategoryDTO } from '@tostao/contracts';
import { CategoryPicker } from '@/components/category-picker';
import { useToast } from '@/components/toast';
import { money, shortDate } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';
import { categorizeInline } from './actions';

type PendingTx = {
  id: string;
  description: string;
  customDescription: string | null;
  amountInCents: number;
  occurredAt: string;
};

/**
 * Modo "Categorizar pendentes": uma transação por vez, um toque na categoria e a próxima já aparece, sem trocar de
 * página. A fila é derivada da lista que o servidor mandou menos o que já foi categorizado/pulado aqui.
 */
export function CategorizeQueue({
  pending,
  categories,
  exitHref,
  locale = 'pt-BR',
}: {
  pending: PendingTx[];
  categories: CategoryDTO[];
  exitHref: string;
  locale?: Locale;
}) {
  const w = getDictionary(locale).growth.wallet;
  const toast = useToast();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<string[]>([]);
  const [remember, setRemember] = useState(true);
  const [busy, startTransition] = useTransition();

  const queue = pending.filter((t) => !done.has(t.id));
  // Os pulados vão pro fim da fila (a pessoa volta neles depois).
  const ordered = [...queue.filter((t) => !skipped.includes(t.id)), ...queue.filter((t) => skipped.includes(t.id))];
  const current = ordered[0];

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-menta-clara p-5 text-center">
        <p className="text-[15px] font-semibold">{w.categorizeDone}</p>
        <Link href={exitHref} className="text-sm font-semibold underline">
          {w.exitMode}
        </Link>
      </div>
    );
  }

  const kind = current.amountInCents > 0 ? 'entrada' : 'saida';

  const pick = (categoryId: string) => {
    startTransition(async () => {
      const r = await categorizeInline(current.id, categoryId, remember).catch(() => ({ error: w.categorizeError }));
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setDone((prev) => new Set(prev).add(current.id));
      toast.success(w.categorized);
    });
  };

  return (
    <section
      aria-label={w.categorizeMode}
      className="flex flex-col gap-3 rounded-[22px] border border-linha bg-cartao p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[15px] font-bold">{w.categorizeTitle(ordered.length)}</h2>
          <p className="text-xs text-tinta-suave">{w.categorizeHint}</p>
        </div>
        <Link href={exitHref} className="text-[13px] font-semibold text-tinta-suave underline">
          {w.exitMode}
        </Link>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-papel-2 px-3.5 py-3">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold">{current.customDescription || current.description}</span>
          <span className="text-xs text-tinta-suave">{shortDate(current.occurredAt, locale)}</span>
        </span>
        <span
          className={`shrink-0 text-[17px] font-bold tabular-nums ${current.amountInCents > 0 ? 'text-verde-texto' : ''}`}
        >
          {current.amountInCents > 0 ? '+ ' : ''}
          {money(Math.abs(current.amountInCents))}
        </span>
      </div>
      {/* Um toque numa categoria (ou numa recém-criada em "+ Criar categoria") já categoriza e passa pra próxima. */}
      <div aria-busy={busy}>
        <CategoryPicker
          categories={categories}
          kind={kind}
          includeNeutral
          value={null}
          onChange={(id) => id && pick(id)}
          label={w.categorizeMode}
          disabled={busy}
          locale={locale}
        />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13px] leading-[18px] text-tinta-suave">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-tinta"
        />
        <span>{w.remember}</span>
      </label>
      {ordered.length > 1 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setSkipped((prev) => [...prev, current.id])}
          className="self-start text-[13px] font-semibold text-tinta-suave underline"
        >
          {w.skip}
        </button>
      )}
    </section>
  );
}

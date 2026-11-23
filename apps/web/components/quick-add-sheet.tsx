'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { AnotarForm } from '@/app/(app)/anotar/anotar-form';
import { loadQuickAddData, type QuickAddData } from '@/app/(app)/carteira/actions';
import { getDictionary, type Locale } from '@/lib/i18n';

/**
 * Tela inteira no mobile (e modal centralizado no desktop) que abre o mesmo `AnotarForm` completo de `/anotar`.
 * Unifica "Anotar gasto" e "Anotar lançamento" em um único fluxo robusto.
 */
export function QuickAddSheet({
  open,
  onClose,
  locale = 'pt-BR',
}: {
  open: boolean;
  onClose: () => void;
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  const q = dict.growth.quickAdd;
  const a = dict.pages.anotar;
  const pathname = usePathname();
  const [data, setData] = useState<QuickAddData | null>(null);
  const [failed, setFailed] = useState(false);
  const loading = useRef(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const fetchQuickAddData = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    setFailed(false);
    loadQuickAddData()
      .then((r) => {
        if (r.data) setData(r.data);
        else setFailed(true);
      })
      .catch(() => setFailed(true))
      .finally(() => {
        loading.current = false;
      });
  }, []);

  // Os dados vêm quando abre pela primeira vez (e ficam em memória nas próximas aberturas).
  useEffect(() => {
    if (!open || data) return;
    fetchQuickAddData();
  }, [open, data, fetchQuickAddData]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const dialog = (
    <div className="fixed inset-0 z-50 flex flex-col bg-papel text-tinta md:items-center md:justify-center md:bg-tinta-fixa/45 md:p-6 md:backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={a.headerTitle}
        className="flex min-h-0 w-full grow flex-col overflow-x-hidden bg-papel md:max-h-[90dvh] md:max-w-[560px] md:grow-0 md:overflow-hidden md:rounded-[26px] md:border md:border-linha md:shadow-2xl"
      >
        <div className="mx-auto flex w-full max-w-[520px] shrink-0 items-center justify-between px-3 pt-[max(12px,env(safe-area-inset-top))] pb-1 md:max-w-none md:px-5 md:pt-4">
          <button
            type="button"
            onClick={onClose}
            aria-label={q.close}
            className="flex h-11 w-11 items-center justify-center rounded-full text-tinta transition-colors hover:bg-papel-2"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <span className="text-[13px] font-semibold text-tinta-suave">{a.headerTitle}</span>
          <span className="w-11" aria-hidden="true" />
        </div>
        {data ? (
          <AnotarForm
            categories={data.categories}
            contas={data.contas}
            people={data.people}
            today={data.today}
            recents={data.recents}
            back={pathname}
            locale={locale}
            stayOnSave
            onDone={(another) => {
              if (!another) onClose();
            }}
          />
        ) : failed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <p role="alert" className="text-sm font-semibold text-vermelho-texto">
              {q.loadError}
            </p>
            <button
              type="button"
              onClick={fetchQuickAddData}
              className="inline-flex h-10 items-center justify-center rounded-full bg-tinta px-4 text-sm font-semibold text-papel"
            >
              Tentar de novo
            </button>
          </div>
        ) : (
          <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-tinta-suave">
            {q.loading}
          </p>
        )}
      </div>
    </div>
  );
  return mounted ? createPortal(dialog, document.body) : dialog;
}

/** Botão que abre o lançamento completo: `fab` (laranja, flutuante, some no desktop `lg:`) ou `inline` (pílula na página). */
export function QuickAddButton({
  variant = 'inline',
  label,
  locale = 'pt-BR',
}: {
  variant?: 'fab' | 'inline';
  label: string;
  locale?: Locale;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const cleanLabel = variant === 'fab' ? label.replace(/^\+\s*/, '') : label;
  const className =
    variant === 'fab'
      ? 'fixed right-5 bottom-[calc(86px+env(safe-area-inset-bottom))] z-20 flex h-13 items-center gap-2 rounded-full bg-laranja pr-5 pl-4 text-[15px] font-bold text-tinta-fixa shadow-[0_4px_16px_rgba(30,27,24,0.28)] md:bottom-6 lg:hidden'
      : 'flex h-11 items-center justify-center rounded-full bg-laranja px-5 text-[15px] font-bold text-tinta-fixa';
  const btn = (
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={className}>
      {variant === 'fab' && (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      )}
      {cleanLabel}
    </button>
  );
  return (
    <>
      {variant === 'fab' && mounted ? createPortal(btn, document.body) : btn}
      <QuickAddSheet open={open} onClose={() => setOpen(false)} locale={locale} />
    </>
  );
}

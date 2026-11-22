'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { Dictionary } from '@/lib/i18n';
import { EntryForm } from './entry-form';

export function NewSplitButton({
  personId,
  personName,
  people = [],
  label,
  title,
  cashNote,
  errorMessage,
  t,
}: {
  personId?: string;
  personName?: string;
  people?: string[];
  label: string;
  title: string;
  cashNote?: string;
  errorMessage?: string | null;
  t?: Dictionary['pages']['acertos']['entryForm'];
}) {
  const [open, setOpen] = useState(Boolean(errorMessage));
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const dialog = open ? (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => setOpen(false)}
        tabIndex={-1}
        className="absolute inset-0 bg-tinta-fixa/45 motion-safe:animate-[toast-in_0.15s_ease-out]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[90dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[26px] border border-linha bg-papel shadow-2xl md:rounded-[26px]"
      >
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
          <h2 className="font-display text-xl font-extrabold text-tinta">
            {personName ? `${title} · ${personName}` : title}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-tinta hover:bg-papel-2"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pt-1 pb-[max(24px,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-3">
            {errorMessage && (
              <p role="alert" className="rounded-xl bg-rosa px-3 py-2 text-sm font-medium text-vermelho-texto">
                {errorMessage}
              </p>
            )}
            <EntryForm personId={personId} people={people} t={t} />
            {cashNote && <p className="text-xs leading-[18px] text-tinta-suave">{cashNote}</p>}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-laranja px-4 text-sm font-bold text-tinta-fixa transition hover:opacity-95"
      >
        <span aria-hidden="true">+</span>
        <span>{label}</span>
      </button>
      {dialog && (mounted ? createPortal(dialog, document.body) : dialog)}
    </>
  );
}

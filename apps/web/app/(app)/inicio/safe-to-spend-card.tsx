'use client';
// T6.17 · uma linha pequena logo abaixo do saldo; tocar abre a janela com a conta. É de cliente por causa da janela e
// do "esconder valores" (o olho do cartão de saldo).
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogA11y } from '@/lib/use-dialog-a11y';
import { MASKED, useHiddenBalance } from './balance-card';

export type SafeToSpendCardProps = {
  /** Texto da linha, curto pra caber ao lado do valor. */
  lineLabel: string;
  title: string;
  amount: string;
  /** "Falta" quando o mês não fecha; vazio quando sobra. O valor nunca vai com sinal de menos. */
  amountPrefix: string;
  short: boolean;
  caption: string;
  explanation: string;
  closeLabel: string;
  rows: { label: string; value: string; minus?: boolean; total?: boolean }[];
  note: string;
};

export function SafeToSpendCard(p: SafeToSpendCardProps) {
  const [open, setOpen] = useState(false);
  const hidden = useHiddenBalance();
  const show = (value: string) => (hidden ? `R$ ${MASKED}` : value);
  const headline = `${p.amountPrefix} ${show(p.amount)}`.trim();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-card px-[18px] py-2.5 text-left text-tinta lg:px-7 ${p.short ? 'bg-amarelo-claro' : 'bg-menta-clara'}`}
      >
        <span className="min-w-0 text-small font-semibold">{p.lineLabel}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-display text-[18px] leading-6 font-extrabold tabular-nums">{headline}</span>
          <span aria-hidden="true" className="text-[20px] leading-none">
            ›
          </span>
        </span>
      </button>
      {open && (
        <SafeToSpendDialog {...p} headline={headline} show={show} hidden={hidden} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function SafeToSpendDialog({
  headline,
  show,
  hidden,
  onClose,
  ...p
}: SafeToSpendCardProps & {
  headline: string;
  show: (value: string) => string;
  hidden: boolean;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  // Foco preso na janela, Esc fecha, a página não rola por trás e o foco volta pra linha.
  useDialogA11y({ open: true, containerRef: panel, onClose, initialFocusRef: closeButton });

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[88dvh] w-full max-w-[440px] flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-papel p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-tinta outline-none md:rounded-[28px]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-xs font-semibold tracking-[0.08em] uppercase">
            {p.title}
          </h2>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-11 shrink-0 items-center px-2 text-small font-semibold text-tinta-suave"
          >
            {p.closeLabel}
          </button>
        </div>

        <div
          className={`flex flex-col gap-1 rounded-card px-4 py-3.5 ${p.short ? 'bg-amarelo-claro' : 'bg-menta-clara'}`}
        >
          <p className="font-display text-[34px] leading-[40px] font-extrabold break-words tabular-nums">{headline}</p>
          <p className="text-body leading-[21px] font-semibold">{p.caption}</p>
          {p.explanation && <p className="text-small leading-[19px]">{p.explanation}</p>}
        </div>

        <dl className="flex flex-col gap-1.5 text-small leading-[19px]">
          {p.rows.map((row) => (
            <div
              key={row.label}
              className={`flex items-baseline justify-between gap-3 ${row.total ? 'border-t border-tinta/25 pt-1.5 font-bold' : ''}`}
            >
              <dt className="min-w-0">{row.label}</dt>
              <dd className="shrink-0 tabular-nums">
                {row.minus && !hidden ? '− ' : ''}
                {show(row.value)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-[17px] text-tinta-suave">{p.note}</p>
      </div>
    </div>,
    document.body,
  );
}

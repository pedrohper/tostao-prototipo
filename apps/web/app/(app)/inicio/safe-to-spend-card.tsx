'use client';
// T6.17 · o número grande acima do saldo. É de cliente só pra obedecer o "esconder valores" (o olho do cartão de saldo).
import { MASKED, useHiddenBalance } from './balance-card';

export type SafeToSpendCardProps = {
  title: string;
  amount: string;
  short: boolean;
  caption: string;
  explanation: string;
  detailsLabel: string;
  rows: { label: string; value: string; minus?: boolean; total?: boolean }[];
  note: string;
};

export function SafeToSpendCard(p: SafeToSpendCardProps) {
  const hidden = useHiddenBalance();
  const show = (value: string) => (hidden ? `R$ ${MASKED}` : value);
  return (
    <section
      aria-label={p.title}
      className={`flex flex-col gap-1 rounded-[22px] px-[18px] pt-4 pb-2 text-tinta lg:px-7 lg:pt-5 ${p.short ? 'bg-amarelo-claro' : 'bg-menta-clara'}`}
    >
      <h2 className="text-xs font-semibold tracking-[0.08em] uppercase">{p.title}</h2>
      <p className="font-display text-[44px] leading-[48px] font-extrabold tracking-[-0.5px] break-words tabular-nums">
        {show(p.amount)}
      </p>
      <p className="text-[15px] leading-[21px] font-semibold">{p.caption}</p>
      <p className="text-[13px] leading-[19px]">{p.explanation}</p>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 self-start text-[13px] font-semibold underline underline-offset-2 [&::-webkit-details-marker]:hidden">
          {p.detailsLabel}
          <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">
            ›
          </span>
        </summary>
        <div className="flex max-w-md flex-col gap-2 pb-2">
          <dl className="flex flex-col gap-1 text-[13px] leading-[19px]">
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
          <p className="text-xs leading-[17px]">{p.note}</p>
        </div>
      </details>
    </section>
  );
}

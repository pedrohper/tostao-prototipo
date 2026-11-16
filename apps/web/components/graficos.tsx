import Link from 'next/link';
import { money, monthName } from '@/lib/format';
import { getDictionary, type Dictionary, type Locale } from '@/lib/i18n';

const curto = (m: string, locale: Locale) => monthName(m, locale).slice(0, 3);
/** "R$ 1,2 mil" pra caber em cima da barra. */
const compacto = (cents: number, thousandUnit: string) => {
  const r = cents / 100;
  if (r >= 1000) return `${(r / 1000).toFixed(r >= 10000 ? 0 : 1).replace('.', ',')} ${thousandUnit}`;
  return `${Math.round(r)}`;
};

/** Barras por mês. Com `entrada`, mostra entrou (menta) e saiu (laranja) lado a lado. */
export function MonthlyBars({
  data,
  atual,
  entrada = false,
  altura = 112,
  locale = 'pt-BR',
  t,
}: {
  data: { month: string; outInCents: number; inInCents?: number }[];
  atual: string;
  entrada?: boolean;
  altura?: number;
  locale?: Locale;
  t?: Dictionary['walletExtra']['accountDetail'];
}) {
  const labels = t ?? getDictionary(locale).walletExtra.accountDetail;
  const max = Math.max(1, ...data.map((d) => Math.max(d.outInCents, entrada ? (d.inInCents ?? 0) : 0)));
  const h = (v: number) => (v > 0 ? Math.max(3, Math.round((v / max) * altura)) : 0);
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-end justify-between gap-1.5"
        style={{ height: altura + 18 }}
        role="img"
        aria-label={data
          .map((d) =>
            labels.barsAriaItem(
              monthName(d.month, locale),
              money(d.outInCents),
              entrada ? money(d.inInCents ?? 0) : null,
            ),
          )
          .join('; ')}
      >
        {data.map((d) => {
          const on = d.month === atual;
          return (
            <div key={d.month} className="flex flex-1 flex-col items-center justify-end gap-1">
              {!entrada && (
                <span className={`text-[10px] font-semibold tabular-nums ${on ? 'text-tinta' : 'text-tinta-suave'}`}>
                  {d.outInCents > 0 ? compacto(d.outInCents, labels.thousandUnit) : ''}
                </span>
              )}
              <div className="flex w-full items-end justify-center gap-[3px]">
                {entrada && (
                  <div
                    className={`w-[42%] max-w-4 rounded-t-[5px] bg-menta ${on ? '' : 'opacity-50'}`}
                    style={{ height: h(d.inInCents ?? 0) }}
                  />
                )}
                <div
                  className={`${entrada ? 'w-[42%] max-w-4' : 'w-full max-w-9'} rounded-t-[6px] ${on ? 'bg-laranja' : 'bg-laranja/35'}`}
                  style={{ height: h(d.outInCents) }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-1.5 border-t border-linha pt-1.5">
        {data.map((d) => (
          <span
            key={d.month}
            className={`flex-1 text-center text-[11px] font-semibold capitalize ${d.month === atual ? 'text-tinta' : 'text-tinta-suave'}`}
          >
            {curto(d.month, locale)}
          </span>
        ))}
      </div>
      {entrada && (
        <div className="flex gap-3 text-[11px] font-semibold text-tinta-suave">
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-menta" />
            {labels.barsInLegend}
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-laranja" />
            {labels.barsOutLegend}
          </span>
        </div>
      )}
    </div>
  );
}

/** Barra empilhada + lista: pra onde foi o dinheiro. */
/** Com `href`, cada categoria vira link (pra ver só os gastos dela). */
export function CategoryBars({
  items,
  max = 6,
  href,
  ativa,
  otherLabel = 'Outras',
}: {
  items: { categoryId: string | null; name: string; color: string; totalInCents: number }[];
  max?: number;
  href?: (categoryId: string | null) => string;
  ativa?: string | null;
  otherLabel?: string;
}) {
  const total = items.reduce((s, c) => s + c.totalInCents, 0);
  if (!total) return null;
  const top = items.slice(0, max);
  const resto = items.slice(max).reduce((s, c) => s + c.totalInCents, 0);
  const lista =
    resto > 0
      ? [...top, { categoryId: '_resto', name: otherLabel, color: 'var(--color-linha)', totalInCents: resto }]
      : top;
  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="flex h-3.5 overflow-hidden rounded-full bg-papel-2"
        role="img"
        aria-label={lista.map((c) => `${c.name} ${Math.round((c.totalInCents / total) * 100)}%`).join(', ')}
      >
        {lista.map((c) => (
          <div
            key={c.categoryId ?? 'sem'}
            style={{
              width: `${(c.totalInCents / total) * 100}%`,
              background: c.categoryId ? c.color : 'var(--color-rosa-forte)',
            }}
            className="border-r-2 border-cartao last:border-r-0"
          />
        ))}
      </div>
      <ul className="flex flex-col">
        {lista.map((c) => {
          const conteudo = (
            <>
              <i
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: c.categoryId ? c.color : 'var(--color-rosa-forte)' }}
              />
              <span className={`grow truncate ${ativa && ativa === (c.categoryId ?? 'sem') ? 'font-bold' : ''}`}>
                {c.name}
              </span>
              <span className="text-xs text-tinta-suave tabular-nums">
                {Math.round((c.totalInCents / total) * 100)}%
              </span>
              <span className="w-[92px] text-right font-semibold tabular-nums">{money(c.totalInCents)}</span>
              {href && c.categoryId !== '_resto' && (
                <span aria-hidden="true" className="-mr-1 text-tinta-suave">
                  ›
                </span>
              )}
            </>
          );
          return (
            <li key={c.categoryId ?? 'sem'}>
              {href && c.categoryId !== '_resto' ? (
                <Link
                  href={href(c.categoryId)}
                  className="flex min-h-10 items-center gap-2 text-sm text-tinta no-underline"
                >
                  {conteudo}
                </Link>
              ) : (
                <span className="flex min-h-8 items-center gap-2 text-sm">{conteudo}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Limite do cartão: quanto já foi usado. */
export function BudgetProgressBar({
  usado,
  limite,
  t,
}: {
  usado: number;
  limite: number;
  t?: Dictionary['walletExtra']['accountDetail'];
}) {
  const labels = t ?? getDictionary('pt-BR').walletExtra.accountDetail;
  const pct = Math.min(100, Math.round((usado / Math.max(1, limite)) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-2.5 overflow-hidden rounded-full bg-papel-2"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={labels.limitUsedAria}
      >
        <div
          className={`h-full rounded-full ${pct >= 90 ? 'bg-alerta' : pct >= 70 ? 'bg-amarelo' : 'bg-menta'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-tinta-suave">
        <span>{labels.usedLabel(money(usado), pct)}</span>
        <span>{labels.freeLabel(money(Math.max(0, limite - usado)))}</span>
      </div>
    </div>
  );
}

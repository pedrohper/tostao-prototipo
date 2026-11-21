'use client';
import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CatIcon } from '@/components/icone';
import { money, monthName } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';
import { linePoints, nearestIndex, pathFromPoints, pctOf, stackedSegments, stepIndex } from '@/lib/chart-math';

// Client Components: tooltip por toque, mouse e teclado. As props são só dados simples (strings, números, listas):
// nada de função vinda do servidor, e os textos saem do dicionário pelo `locale`.

const curto = (m: string, locale: Locale) => monthName(m, locale).slice(0, 3);
/** "R$ 1,2 mil" pra caber em cima da barra. */
const compacto = (cents: number, thousandUnit: string) => {
  const r = cents / 100;
  if (r >= 1000) return `${(r / 1000).toFixed(r >= 10000 ? 0 : 1).replace('.', ',')} ${thousandUnit}`;
  return `${Math.round(r)}`;
};

type MonthPoint = { month: string; outInCents: number; inInCents?: number };

/** Painel de valores do mês em foco (o "tooltip"). Fixo abaixo do gráfico: não cobre nada e funciona igual no toque. */
function MonthReadout({
  point,
  locale,
  showIn,
  baseForPct,
  href,
}: {
  point: MonthPoint | null;
  locale: Locale;
  showIn: boolean;
  /** Base do "% da renda" (entrada do mês) ou, sem renda, do total de gastos mostrado. */
  baseForPct: { value: number; kind: 'income' | 'spending' };
  href?: string;
}) {
  const g = getDictionary(locale).growth.charts;
  if (!point) {
    return <p className="min-h-[44px] text-[12px] leading-[16px] text-tinta-suave">{g.hintTouch}</p>;
  }
  const pct = pctOf(point.outInCents, baseForPct.value);
  return (
    <div
      role="status"
      aria-live="polite"
      data-tooltip="true"
      className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl bg-papel-2 px-3 py-1.5 text-[13px]"
    >
      <b className="capitalize">
        {monthName(point.month, locale)} {point.month.slice(0, 4)}
      </b>
      {showIn && (
        <span className="text-verde-texto tabular-nums">
          {g.inLabel} {money(point.inInCents ?? 0)}
        </span>
      )}
      <span className="tabular-nums">
        {g.outLabel} {money(point.outInCents)}
        {pct !== null && (
          <span className="text-tinta-suave">
            {' '}
            · {baseForPct.kind === 'income' ? g.ofIncome(pct) : g.ofSpending(pct)}
          </span>
        )}
      </span>
      {href && (
        <Link href={href} className="ml-auto text-[13px] font-semibold text-laranja-texto no-underline">
          {g.viewMonth(monthName(point.month, locale))} ›
        </Link>
      )}
    </div>
  );
}

/**
 * Barras por mês. Com `entrada`, mostra entrou (menta) e saiu (laranja) lado a lado.
 * Mouse: passar mostra os valores e clicar abre o mês. Toque: o 1º toque mostra os valores, o 2º abre o mês.
 * Teclado: focar mostra, Enter abre. `monthBasePath` liga as barras a `<caminho>?mes=AAAA-MM`.
 */
export function MonthlyBars({
  data,
  atual,
  entrada = false,
  altura = 112,
  locale = 'pt-BR',
  monthBasePath,
}: {
  data: MonthPoint[];
  atual: string;
  entrada?: boolean;
  altura?: number;
  locale?: Locale;
  monthBasePath?: string;
}) {
  const labels = getDictionary(locale).walletExtra.accountDetail;
  const router = useRouter();
  const pointer = useRef<string>('mouse');
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.outInCents, entrada ? (d.inInCents ?? 0) : 0)));
  const h = (v: number) => (v > 0 ? Math.max(3, Math.round((v / max) * altura)) : 0);
  const hrefFor = (m: string) => (monthBasePath ? `${monthBasePath}?mes=${m}` : undefined);
  const focus = active !== null ? (data[active] ?? null) : null;
  const totalOut = data.reduce((s, d) => s + d.outInCents, 0);
  const baseForPct =
    entrada && focus && (focus.inInCents ?? 0) > 0
      ? { value: focus.inInCents ?? 0, kind: 'income' as const }
      : { value: totalOut, kind: 'spending' as const };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-1.5" style={{ height: altura + 18 }}>
        {data.map((d, i) => {
          const on = d.month === atual;
          const selected = active === i;
          const ariaLabel = labels.barsAriaItem(
            monthName(d.month, locale),
            money(d.outInCents),
            entrada ? money(d.inInCents ?? 0) : null,
          );
          return (
            <button
              key={d.month}
              type="button"
              aria-label={ariaLabel}
              aria-pressed={selected}
              onPointerEnter={(e) => {
                pointer.current = e.pointerType;
                if (e.pointerType === 'mouse') setActive(i);
              }}
              onPointerDown={(e) => {
                pointer.current = e.pointerType;
              }}
              onFocus={() => setActive(i)}
              onClick={() => {
                const href = hrefFor(d.month);
                // Toque: 1º toque mostra os valores, 2º abre. Mouse e teclado abrem direto (já estavam em foco).
                if (href && (pointer.current === 'mouse' || pointer.current === 'pen' || selected)) router.push(href);
                else setActive(i);
              }}
              className={`flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-tinta ${selected ? 'bg-papel-2' : ''}`}
            >
              {!entrada && (
                <span className={`text-[10px] font-semibold tabular-nums ${on ? 'text-tinta' : 'text-tinta-suave'}`}>
                  {d.outInCents > 0 ? compacto(d.outInCents, labels.thousandUnit) : ''}
                </span>
              )}
              <div className="flex w-full items-end justify-center gap-[3px]">
                {entrada && (
                  <div
                    className={`w-[42%] max-w-4 rounded-t-[5px] bg-menta ${on || selected ? '' : 'opacity-50'}`}
                    style={{ height: h(d.inInCents ?? 0) }}
                  />
                )}
                <div
                  className={`${entrada ? 'w-[42%] max-w-4' : 'w-full max-w-9'} rounded-t-[6px] ${on || selected ? 'bg-laranja' : 'bg-laranja/35'}`}
                  style={{ height: h(d.outInCents) }}
                />
              </div>
            </button>
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
      <MonthReadout
        point={focus}
        locale={locale}
        showIn={entrada}
        baseForPct={baseForPct}
        href={focus ? hrefFor(focus.month) : undefined}
      />
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

const CHART_W = 320;
const CHART_H = 132;

/**
 * Linhas de entrou (menta) e saiu (laranja) por mês, em SVG puro (sem biblioteca: nada a mais no bundle).
 * Toque ou mouse sobre o gráfico mostra o mês mais perto; setas/Home/End no teclado trocam de mês.
 */
export function CashflowLineChart({
  data,
  atual,
  locale = 'pt-BR',
  monthBasePath,
}: {
  data: { month: string; inInCents: number; outInCents: number }[];
  atual: string;
  locale?: Locale;
  monthBasePath?: string;
}) {
  const g = getDictionary(locale).growth.charts;
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  if (data.length < 2) return null;

  const max = Math.max(1, ...data.map((d) => Math.max(d.inInCents, d.outInCents)));
  const dims = { width: CHART_W, height: CHART_H, max };
  const inPts = linePoints(
    data.map((d) => d.inInCents),
    dims,
  );
  const outPts = linePoints(
    data.map((d) => d.outInCents),
    dims,
  );
  const current = active ?? data.findIndex((d) => d.month === atual);
  const focus = active !== null ? data[active]! : null;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        tabIndex={0}
        aria-label={g.flowAria}
        aria-describedby={`${id}-readout`}
        onKeyDown={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            setActive(stepIndex(active ?? Math.max(0, current), e.key, data.length));
          } else if (e.key === 'Escape') setActive(null);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setActive(null);
        }}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          if (box.width === 0) return;
          setActive(nearestIndex(outPts, ((e.clientX - box.left) / box.width) * CHART_W));
        }}
        onPointerDown={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          if (box.width === 0) return;
          setActive(nearestIndex(outPts, ((e.clientX - box.left) / box.width) * CHART_W));
        }}
        className="touch-pan-y rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-tinta"
      >
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="block h-auto w-full" aria-hidden="true">
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1="0"
              x2={CHART_W}
              y1={12 + (CHART_H - 24) * f}
              y2={12 + (CHART_H - 24) * f}
              stroke="var(--color-linha)"
              strokeDasharray="3 4"
            />
          ))}
          {active !== null && (
            <line
              x1={outPts[active]!.x}
              x2={outPts[active]!.x}
              y1="6"
              y2={CHART_H - 6}
              stroke="var(--color-tinta-suave)"
              strokeWidth="1"
            />
          )}
          <path
            d={pathFromPoints(inPts)}
            fill="none"
            stroke="var(--color-menta)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={pathFromPoints(outPts)}
            fill="none"
            stroke="var(--color-laranja)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {data.map((d, i) => (
            <g key={d.month}>
              <circle
                cx={inPts[i]!.x}
                cy={inPts[i]!.y}
                r={i === current ? 4.5 : 3}
                fill="var(--color-menta)"
                stroke="var(--color-cartao)"
                strokeWidth="1.5"
              />
              <circle
                cx={outPts[i]!.x}
                cy={outPts[i]!.y}
                r={i === current ? 4.5 : 3}
                fill="var(--color-laranja)"
                stroke="var(--color-cartao)"
                strokeWidth="1.5"
              />
            </g>
          ))}
        </svg>
        <div className="flex justify-between px-1">
          {data.map((d, i) => (
            <span
              key={d.month}
              className={`flex-1 text-center text-[11px] font-semibold capitalize ${i === current ? 'text-tinta' : 'text-tinta-suave'}`}
            >
              {curto(d.month, locale)}
            </span>
          ))}
        </div>
      </div>
      <div id={`${id}-readout`}>
        <MonthReadout
          point={focus ? { month: focus.month, outInCents: focus.outInCents, inInCents: focus.inInCents } : null}
          locale={locale}
          showIn
          baseForPct={{ value: focus?.inInCents ?? 0, kind: 'income' }}
          href={focus && monthBasePath ? `${monthBasePath}?mes=${focus.month}` : undefined}
        />
      </div>
      <div className="flex gap-3 text-[11px] font-semibold text-tinta-suave">
        <span className="flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-menta" />
          {g.inLabel}
        </span>
        <span className="flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-laranja" />
          {g.outLabel}
        </span>
      </div>
    </div>
  );
}

/**
 * Barra empilhada + lista: pra onde foi o dinheiro. A cor de cada fatia é a da categoria (a mesma da bolinha da lista).
 * Com `hrefBase`, a fatia e a linha viram link pra `<hrefBase>?<hrefParams>&cat=<categoria>#lista` (a Carteira filtrada).
 */
export function CategoryBars({
  items,
  max = 6,
  hrefBase,
  hrefParams,
  ativa,
  otherLabel = 'Outras',
  locale = 'pt-BR',
}: {
  items: { categoryId: string | null; name: string; color: string; totalInCents: number }[];
  max?: number;
  hrefBase?: string;
  hrefParams?: Record<string, string>;
  ativa?: string | null;
  otherLabel?: string;
  locale?: Locale;
}) {
  const g = getDictionary(locale).growth.charts;
  const total = items.reduce((s, c) => s + c.totalInCents, 0);
  if (!total) return null;
  const top = items.slice(0, max);
  const resto = items.slice(max).reduce((s, c) => s + c.totalInCents, 0);
  const lista = (
    resto > 0
      ? [...top, { categoryId: '_resto', name: otherLabel, color: 'var(--color-linha)', totalInCents: resto }]
      : top
  ).filter((c) => c.totalInCents > 0); // mesma lista que `stackedSegments` usa: índice a índice
  const segments = stackedSegments(
    lista.map((c) => ({ ...c, color: c.categoryId ? c.color : 'var(--color-rosa-forte)' })),
    total,
  );
  const hrefFor = (categoryId: string | null) =>
    hrefBase
      ? `${hrefBase}?${new URLSearchParams({ ...hrefParams, cat: categoryId ?? 'sem' }).toString()}#lista`
      : undefined;
  const linkable = (id: string | null) => Boolean(hrefBase) && id !== '_resto';
  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="flex h-3.5 overflow-hidden rounded-full bg-papel-2"
        role="img"
        aria-label={lista.map((c) => `${c.name} ${Math.round((c.totalInCents / total) * 100)}%`).join(', ')}
      >
        {segments.map((s, i) => {
          const c = lista[i]!;
          const style = { width: `${s.widthPct}%`, background: s.color };
          const cls = 'border-r-2 border-cartao last:border-r-0';
          return linkable(c.categoryId) ? (
            <Link
              key={s.key}
              href={hrefFor(c.categoryId)!}
              title={`${c.name} · ${money(c.totalInCents)} · ${s.pct}%`}
              aria-label={g.categoryLink(c.name)}
              style={style}
              className={cls}
            />
          ) : (
            <div key={s.key} style={style} className={cls} />
          );
        })}
      </div>
      <ul className="flex flex-col">
        {lista.map((c) => {
          const color = c.categoryId ? c.color : 'var(--color-rosa-forte)';
          const conteudo = (
            <>
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-tinta-fixa"
                style={{ background: color }}
                aria-hidden="true"
              >
                {c.categoryId && c.categoryId !== '_resto' ? (
                  <CatIcon id={c.categoryId} emoji={null} size={18} />
                ) : null}
              </span>
              <span className={`grow truncate ${ativa && ativa === (c.categoryId ?? 'sem') ? 'font-bold' : ''}`}>
                {c.name}
              </span>
              <span className="text-xs text-tinta-suave tabular-nums">
                {Math.round((c.totalInCents / total) * 100)}%
              </span>
              <span className="w-[92px] text-right font-semibold tabular-nums">{money(c.totalInCents)}</span>
              {linkable(c.categoryId) && (
                <span aria-hidden="true" className="-mr-1 text-tinta-suave">
                  ›
                </span>
              )}
            </>
          );
          return (
            <li key={c.categoryId ?? 'sem'}>
              {linkable(c.categoryId) ? (
                <Link
                  href={hrefFor(c.categoryId)!}
                  className="flex min-h-11 items-center gap-2 text-sm text-tinta no-underline"
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
  locale = 'pt-BR',
}: {
  usado: number;
  limite: number;
  locale?: Locale;
}) {
  const labels = getDictionary(locale).walletExtra.accountDetail;
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
      <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-xs text-tinta-suave">
        <span>{labels.usedLabel(money(usado), pct)}</span>
        <span>{labels.freeLabel(money(Math.max(0, limite - usado)))}</span>
      </div>
    </div>
  );
}

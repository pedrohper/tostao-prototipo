import Link from 'next/link';
import type { SpendingBase } from '@tostao/contracts';
import { money, monthName } from '@/lib/format';
import { getDictionary, type Dictionary, type Locale } from '@/lib/i18n';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const mes = (m: string, locale: Locale) => cap(monthName(m, locale).slice(0, 3));

/**
 * Como o "dia a dia" foi calculado: mediana dos últimos 3 meses, sem o que foi pago com dinheiro extra.
 * Diz também se o gasto acima da renda foi exceção (acerto, 13º) ou se é aperto de verdade.
 */
export function DailySpendingBase({
  base,
  dailyInCents,
  locale = 'pt-BR',
  t,
}: {
  base: SpendingBase;
  dailyInCents: number;
  locale?: Locale;
  t?: Dictionary['pages']['calculators']['dailyBase'];
}) {
  if (!base.months.length) return null;
  const labels = t ?? getDictionary(locale).pages.calculators.dailyBase;
  const pagoExtra = base.months.filter((m) => m.paidWithExtraInCents > 0);
  const tom = base.status === 'aperto' ? 'bg-rosa' : base.status === 'excecao' ? 'bg-amarelo-claro' : 'bg-menta-clara';
  const conj = locale === 'en' ? ', ' : locale === 'es' ? ' y ' : ' e ';
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
      <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{labels.eyebrow}</span>
      <p className={`rounded-xl px-3 py-2.5 text-[14px] leading-5 ${tom}`}>
        {base.status === 'aperto' ? (
          <>
            {labels.tightBefore(
              base.months.filter(
                (m) => m.baseInCents > Math.max(base.normalIncomeInCents, m.incomeInCents - m.extraIncomeInCents) * 1.1,
              ).length,
              base.months.length,
            )}
            <Link href="/carteira?filtro=saidas#lista" className="font-semibold text-tinta">
              {labels.tightLink}
            </Link>
            .
          </>
        ) : base.status === 'excecao' ? (
          <>
            {labels.exceptionBefore(
              pagoExtra.map((m) => monthName(m.month, locale)).join(conj),
              money(pagoExtra.reduce((s, m) => s + m.paidWithExtraInCents, 0)),
            )}
          </>
        ) : (
          <>
            <b>{labels.okBefore}</b>
            {labels.okAfter}
          </>
        )}
      </p>
      <div className="flex flex-col text-[14px]">
        <div className="flex justify-between border-b border-linha pb-1.5 text-xs font-semibold text-tinta-suave">
          <span>{labels.colMonth}</span>
          <span>{labels.colOut}</span>
        </div>
        {base.months.map((m) => (
          <Link
            key={m.month}
            href={`/carteira?mes=${m.month}&filtro=saidas#lista`}
            className="flex items-center justify-between border-b border-linha py-1.5 text-tinta no-underline"
          >
            <span className="font-semibold">{mes(m.month, locale)} ›</span>
            <span className="tabular-nums">
              {m.paidWithExtraInCents > 0 && (
                <span className="text-tinta-suave line-through">{money(m.outcomeInCents)}</span>
              )}
              {m.paidWithExtraInCents > 0 ? ' ' : ''}
              {money(m.baseInCents)}
            </span>
          </Link>
        ))}
        <div className="flex justify-between pt-2 text-[14px]">
          <span className="text-tinta-suave">{labels.medianRow}</span>
          <span className="font-semibold tabular-nums">{money(base.typicalInCents)}</span>
        </div>
        <div className="flex justify-between pt-1 text-[14px]">
          <span className="text-tinta-suave">{labels.afterBillsRow}</span>
          <span className="font-bold tabular-nums">{money(dailyInCents)}</span>
        </div>
      </div>
    </section>
  );
}

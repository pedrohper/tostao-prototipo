// "Pra onde foi": sai do resumo do mês, que a página já tem. Versão do celular (barras) e do computador (fatias).
import Link from 'next/link';
import type { MonthSummaryResponse, ProfileResponse } from '@tostao/contracts';
import { CategoryBars } from '@/components/graficos';
import { CatIcon } from '@/components/icone';
import { stackedSegments } from '@/lib/chart-math';
import { ago, money, monthName, nowMs } from '@/lib/format';
import type { Dictionary, Locale } from '@/lib/i18n';

type Props = { summary: MonthSummaryResponse; month: string; locale: Locale; t: Dictionary };

const categorized = (summary: MonthSummaryResponse) => summary.byCategory.filter((c) => c.categoryId);

export function SpendingSection({ summary, profile, month, locale, t }: Props & { profile: ProfileResponse }) {
  const topCategories = categorized(summary);
  const lastSyncIso = profile.connections
    .map((c) => c.lastSyncedAt)
    .filter((iso): iso is string => Boolean(iso))
    .sort()
    .at(-1);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl leading-[26px] font-extrabold">{t.home.whereItWentTitle}</h2>
        <Link
          href={`/carteira?mes=${month}&filtro=saidas#lista`}
          className="text-[13px] font-semibold text-laranja-texto"
        >
          {t.home.viewAll}
        </Link>
      </div>
      {lastSyncIso && (
        <span className="-mt-2 text-xs font-medium text-tinta-suave">
          {t.home.updatedAgo(ago(lastSyncIso, nowMs(), locale))}
        </span>
      )}
      {topCategories.length === 0 && (
        <p className="text-sm text-tinta-suave">{t.home.noCategorizedExpenses(monthName(month, locale))}</p>
      )}
      <CategoryBars
        items={topCategories}
        max={5}
        locale={locale}
        otherLabel={t.common.other}
        hrefBase="/carteira"
        hrefParams={{ mes: month }}
      />
    </section>
  );
}

export function DesktopSpendingCard({ summary, month, locale, t }: Props) {
  const topCategories = categorized(summary);
  const shown = topCategories.slice(0, 5);
  const total = Math.max(1, summary.outcomeInCents || topCategories.reduce((sum, c) => sum + c.totalInCents, 0));
  return (
    <section className="flex flex-col gap-4 rounded-[22px] border border-linha bg-cartao p-[22px]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-[22px] leading-7 font-extrabold text-tinta">{t.home.whereItWentTitle}</h2>
        <Link href={`/carteira?mes=${month}`} className="text-sm font-semibold text-laranja-texto no-underline">
          {t.home.viewWallet}
        </Link>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-tinta-suave">{t.home.noCategorizedExpenses(monthName(month, locale))}</p>
      ) : (
        <>
          <div
            className="flex h-[22px] gap-[3px] overflow-hidden rounded-full bg-papel-2"
            role="img"
            aria-label={shown.map((c) => `${c.name} ${Math.round((c.totalInCents / total) * 100)}%`).join(', ')}
          >
            {/* A cor de cada fatia é a da categoria (cat.color): bate 1:1 com a bolinha da legenda logo abaixo. */}
            {stackedSegments(shown, total).map((seg) => (
              <Link
                key={seg.key}
                href={`/carteira?${new URLSearchParams({ mes: month, cat: seg.key })}#lista`}
                title={`${seg.name} · ${money(seg.totalInCents)} · ${seg.pct}%`}
                aria-label={`${seg.name} ${seg.pct}%`}
                data-segment-color={seg.color}
                className="h-full"
                style={{ width: `${seg.widthPct}%`, background: seg.color }}
              />
            ))}
          </div>
          <div className="flex flex-col">
            {shown.map((cat) => (
              <Link
                key={cat.categoryId}
                href={`/carteira?${new URLSearchParams({ mes: month, cat: cat.categoryId ?? 'sem' })}#lista`}
                className="flex min-h-[54px] items-center gap-3 border-b border-linha py-2 text-tinta no-underline last:border-b-0"
              >
                <span
                  className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl text-tinta-fixa"
                  style={{ background: cat.color || 'var(--color-papel-2)' }}
                  aria-hidden="true"
                >
                  <CatIcon id={cat.categoryId ?? 'outros'} emoji={null} size={22} />
                </span>
                <div className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[15px] font-semibold">{cat.name}</span>
                  <span className="text-xs text-tinta-suave">
                    {t.home.percentOfSpending(Math.round((cat.totalInCents / total) * 100))}
                  </span>
                </div>
                <b className="shrink-0 text-[15px] font-bold tabular-nums">{money(cat.totalInCents)}</b>
              </Link>
            ))}
          </div>
        </>
      )}
      {summary.uncategorizedCount > 0 && (
        <Link
          href="/carteira?filtro=pendentes#lista"
          className="flex items-center justify-between gap-3 rounded-[14px] bg-amarelo-claro px-3.5 py-3 text-sm text-tinta no-underline"
        >
          <span>
            <b>{t.home.uncategorizedAlert(summary.uncategorizedCount)}</b>
          </span>
          <span className="shrink-0 font-semibold text-laranja-texto">{t.wallet.categorizeBadge}</span>
        </Link>
      )}
    </section>
  );
}

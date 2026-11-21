import { PageVisitTracker } from '@/components/visita';
import type { SubscriptionsResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { money, resolveBackHref } from '@/lib/format';
import type { Locale } from '@/lib/i18n';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink, ButtonLink, Card, PageFrame } from '@/components/ui';
import { IgnoreButton } from './ignore-button';

const day = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

/** Calendário da próxima cobrança: "DEZ" em cima, "05" embaixo (dia civil de Brasília, como o resto do app). */
const calendarChip = (iso: string, locale: Locale) => {
  const date = new Date(iso);
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString(locale, { timeZone: 'America/Sao_Paulo', ...o });
  return { month: fmt({ month: 'short' }).replace('.', '').slice(0, 3), day: fmt({ day: '2-digit' }) };
};

export default async function AssinaturasPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [{ voltar }, { subscriptions, ignored, monthlyInCents, yearlyInCents }, { locale, t }] = await Promise.all([
    searchParams,
    api<SubscriptionsResponse>('/subscriptions'),
    getI18n(),
  ]);
  const p = t.pages.assinaturas;
  const active = subscriptions.filter((s) => s.active);
  const stopped = subscriptions.filter((s) => !s.active);
  const cheapest = active.at(-1);
  const backHref = resolveBackHref(voltar, '/carteira?aba=planejar');
  const selfHref = voltar ? `/assinaturas?voltar=${encodeURIComponent(backHref)}` : '/assinaturas';

  const note = (
    <p className="text-center text-[13px] leading-[19px] text-tinta-suave lg:text-left">{p.methodologyNote}</p>
  );

  const secondarySections = (
    <>
      {stopped.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-extrabold">{p.stoppedTitle}</h2>
          <Card className="flex flex-col divide-y divide-linha p-0">
            {stopped.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 p-4 text-tinta-suave">
                <span className="min-w-0 [overflow-wrap:anywhere]">{s.name}</span>
                <span className="shrink-0 text-sm">{p.lastChargeOn(day(s.lastChargedAt, locale))}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {ignored.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-extrabold">{p.ignoredTitle}</h2>
          <Card className="flex flex-col divide-y divide-linha p-0">
            {ignored.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 p-4 text-tinta-suave">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {s.name} · {money(s.amountInCents)}
                </span>
                <IgnoreButton subscriptionKey={s.key} ignored ignoreLabel={p.ignoreBtn} undoLabel={p.undoBtn} />
              </div>
            ))}
          </Card>
        </section>
      )}
    </>
  );

  return (
    <PageFrame size="analytics">
      <PageVisitTracker kind="visita:assinaturas" />
      <BackLink href={backHref} label={t.common.back} />
      <div>
        <h1 className="font-display text-[28px] leading-tight font-extrabold">{p.title}</h1>
        <p className="mt-1 text-[15px] text-tinta-suave">{p.subtitle}</p>
      </div>

      {active.length === 0 ? (
        stopped.length === 0 && ignored.length === 0 ? (
          <div className="flex flex-col gap-5">
            <Card className="flex flex-col items-center gap-3 py-8 text-center">
              <Mascot pose="investigando" size={150} alt="Tostão" />
              <h2 className="font-display text-xl font-extrabold">{p.emptyAllTitle}</h2>
              <p className="max-w-[360px] text-[15px] text-tinta-suave">{p.emptyAllBody}</p>
              <ButtonLink href={`/conectar?voltar=${encodeURIComponent(selfHref)}`} variant="outline">
                {p.checkBanksCta}
              </ButtonLink>
            </Card>
            {note}
          </div>
        ) : (
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-6">
            <div className="flex min-w-0 flex-col gap-4">
              <Card className="flex flex-col items-center gap-3 py-8 text-center">
                <Mascot pose="investigando" size={150} alt="Tostão" />
                <h2 className="font-display text-xl font-extrabold">{p.emptyActiveTitle}</h2>
                <p className="max-w-[320px] text-[15px] text-tinta-suave">{p.emptyActiveBody}</p>
                <ButtonLink href={`/conectar?voltar=${encodeURIComponent(selfHref)}`} variant="outline">
                  {p.checkBanksCta}
                </ButtonLink>
              </Card>
              {note}
            </div>
            <div className="flex min-w-0 flex-col gap-5">{secondarySections}</div>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[0.88fr_1.12fr] lg:items-start lg:gap-6">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="rounded-3xl bg-amarelo p-5 text-tinta-fixa">
              <span className="text-sm font-semibold">{p.activeCount(active.length)}</span>
              <div className="font-display text-[40px] leading-tight font-extrabold tabular-nums">
                {money(monthlyInCents)}
                <span className="text-xl">{p.perMonth}</span>
              </div>
              <p className="mt-1 text-[15px] font-semibold">
                {p.perYearBefore}
                <b className="tabular-nums">{money(yearlyInCents)}</b>
                {p.perYearAfter}
              </p>
            </div>

            {cheapest && (
              <div className="flex items-center gap-3 rounded-[20px] bg-azul p-3.5">
                <Mascot pose="pensando" size={64} alt="Tostão" />
                <p className="text-[15px] leading-snug">
                  {p.cheapestQuestionBefore}
                  <b>{cheapest.name}</b>
                  {p.cheapestQuestionMid}
                  <b>{money(cheapest.amountInCents * 12)}</b>
                  {p.cheapestQuestionAfter}
                </p>
              </div>
            )}

            <div className="hidden lg:block">{note}</div>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            {/* T4.4 · cards visuais: calendário com a próxima cobrança, nome, plano e valor por mês. */}
            <ul className="flex flex-col gap-2.5">
              {active.map((s) => {
                const chip = calendarChip(s.nextChargeAt, locale);
                return (
                  <li key={s.key}>
                    <Card className="flex items-center gap-3 p-3.5">
                      <div
                        aria-hidden="true"
                        className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-amarelo-claro text-tinta-fixa"
                      >
                        <span className="text-[10px] leading-3 font-bold tracking-wider uppercase">{chip.month}</span>
                        <span className="font-display text-[22px] leading-6 font-extrabold tabular-nums">
                          {chip.day}
                        </span>
                      </div>
                      <div className="flex min-w-0 grow flex-col items-start gap-0.5">
                        <span className="font-semibold [overflow-wrap:anywhere]">{s.name}</span>
                        <span className="text-[13px] text-tinta-suave">
                          {p.nextChargeMeta(day(s.nextChargeAt, locale), s.installmentsLeft, s.chargeCount)}
                        </span>
                        {s.duplicateOf && (
                          <span className="mt-1 rounded-full bg-rosa px-2 py-0.5 text-[12px] font-semibold text-tinta">
                            {p.duplicateBadge(s.duplicateOf)}
                          </span>
                        )}
                        <IgnoreButton
                          subscriptionKey={s.key}
                          ignored={false}
                          ignoreLabel={p.ignoreBtn}
                          undoLabel={p.undoBtn}
                        />
                      </div>
                      <span className="shrink-0 text-[17px] font-bold tabular-nums">{money(s.amountInCents)}</span>
                    </Card>
                  </li>
                );
              })}
            </ul>

            {secondarySections}
            <div className="lg:hidden">{note}</div>
          </div>
        </div>
      )}
    </PageFrame>
  );
}

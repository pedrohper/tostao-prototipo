import Link from 'next/link';
import type { ForecastResponse, MissionsResponse, ReminderDTO, WeeklyResponse } from '@tostao/contracts';
import { money, monthName } from '@/lib/format';
import { Icon } from './icone';
import { dismissAlert } from '@/lib/inicio-actions';
import { getDictionary, type Locale } from '@/lib/i18n';

const chevronIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0 text-tinta-suave"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

/** Compact banner shown when all daily missions are completed. */
export function CompletedMissionsCard({ streak, locale = 'pt-BR' }: { streak: number; locale?: Locale }) {
  const t = getDictionary(locale);
  return (
    <Link
      href="/aprender"
      className="flex min-h-14 items-center gap-2.5 rounded-[18px] bg-menta-clara px-3.5 py-2.5 text-tinta no-underline"
    >
      <Icon src="jogo/dia-cumprido" size={28} alt="" />
      <span className="flex min-w-0 grow flex-col">
        <span className="text-[15px] font-bold">{t.engagement.allDoneTitle}</span>
        <span className="text-[13px] text-tinta-suave">{t.engagement.allDoneSubtitle}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[13px] font-bold">
        <Icon src="ui/ofensiva" size={18} />
        {t.engagement.daysCount(streak)}
      </span>
    </Link>
  );
}

/** Today's missions card: completing any mission locks in the daily streak. */
export function DailyMissions({
  data,
  compact = false,
  locale = 'pt-BR',
}: {
  data: MissionsResponse;
  compact?: boolean;
  locale?: Locale;
}) {
  const t = getDictionary(locale);
  const completedCount = data.missions.filter((m) => m.done).length;
  if (data.missions.length > 0 && completedCount === data.missions.length) {
    return <CompletedMissionsCard streak={data.streakDays} locale={locale} />;
  }

  return (
    <section className="relative flex flex-col gap-2.5 rounded-[18px] border border-linha bg-cartao p-3.5">
      <Link
        href="/aprender"
        aria-label={t.engagement.todayMissionsLabel(completedCount, data.missions.length)}
        className="absolute inset-0 rounded-[18px]"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
          {t.engagement.todayMissionsLabel(completedCount, data.missions.length)}
        </span>
        <span className="flex items-center gap-1 text-[13px] font-bold">
          <Icon src="ui/ofensiva" size={18} />
          {t.engagement.daysCount(data.streakDays)}
        </span>
      </div>
      <ul className="flex flex-col">
        {data.missions.map((mission) => (
          <li key={mission.id} className="relative z-[1]">
            <Link href={mission.href} className="flex min-h-11 items-center gap-2.5 text-tinta no-underline">
              {mission.done ? (
                <Icon src="jogo/dia-cumprido" size={24} alt="done" />
              ) : (
                <span
                  aria-label="todo"
                  className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-tinta-suave"
                />
              )}
              <span className={`grow text-[15px] ${mission.done ? 'text-tinta-suave line-through' : 'font-semibold'}`}>
                {mission.title}
              </span>
              {!mission.done && chevronIcon}
            </Link>
          </li>
        ))}
      </ul>
      {!compact && (
        <div className="flex items-center justify-between gap-1 border-t border-linha pt-2.5" role="img">
          {data.week.map((dayItem, idx) => (
            <span
              key={dayItem.day}
              className="flex flex-col items-center gap-1 text-[11px] font-semibold text-tinta-suave"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ${dayItem.done > 0 ? 'bg-laranja' : 'bg-papel-2'}`}
              >
                {dayItem.done > 0 && <Icon src="ui/ofensiva" size={16} />}
              </span>
              {t.weekdaysShort[idx]}
            </span>
          ))}
        </div>
      )}
      <p className="text-[13px] text-tinta-suave">
        {data.todayKept ? t.engagement.streakKeptHint : t.engagement.oneMissionHint}
      </p>
    </section>
  );
}

const REMINDER_ICON: Record<ReminderDTO['kind'], string> = {
  fatura: 'ui/cartao',
  conta: 'cat/casa',
  assinatura: 'cat/assinaturas',
};

const resolveReminderHref = (reminder: ReminderDTO) => {
  if (reminder.kind === 'fatura') {
    const accountId = reminder.key.split(':')[1];
    return accountId ? `/carteira/conta/${accountId}` : '/carteira';
  }
  return reminder.kind === 'assinatura' ? '/assinaturas?voltar=/inicio' : '/renda?voltar=/inicio';
};

/** Bills, credit card statements, and subscriptions due in the next 7 days. */
export function UpcomingReminders({ reminders, locale = 'pt-BR' }: { reminders: ReminderDTO[]; locale?: Locale }) {
  if (!reminders.length) return null;
  const t = getDictionary(locale);
  const formatRelativeDays = (daysLeft: number) =>
    daysLeft === 0 ? t.time.today : daysLeft === 1 ? t.time.tomorrow : t.time.inDays(daysLeft);

  return (
    <section id="vence" className="flex scroll-mt-4 flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl leading-[26px] font-extrabold">{t.engagement.dueSoonTitle}</h2>
        <Link href="/mais/alertas?voltar=/inicio" className="text-[13px] font-semibold text-laranja-texto">
          {t.engagement.remindMeLink}
        </Link>
      </div>
      <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
        {reminders.slice(0, 4).map((reminder) => (
          <div
            key={reminder.key}
            className="flex min-h-[54px] items-center gap-1 border-b border-linha last:border-b-0"
          >
            <Link
              href={resolveReminderHref(reminder)}
              className="flex min-h-[54px] min-w-0 grow items-center gap-3 text-tinta no-underline"
            >
              <Icon src={REMINDER_ICON[reminder.kind]} size={28} />
              <div className="flex min-w-0 grow flex-col">
                <span className="truncate text-[15px] font-semibold">{reminder.title}</span>
                <span
                  className={`text-xs ${reminder.daysLeft <= 1 ? 'font-semibold text-laranja-texto' : 'text-tinta-suave'}`}
                >
                  {t.engagement.duePrefix(formatRelativeDays(reminder.daysLeft))}
                </span>
              </div>
              {reminder.amountInCents !== null && (
                <span className="shrink-0 text-[15px] font-semibold tabular-nums">{money(reminder.amountInCents)}</span>
              )}
            </Link>
            <form action={dismissAlert.bind(null, reminder.key)} className="-mr-2 shrink-0">
              <button
                type="submit"
                aria-label={t.engagement.alreadyPaidLabel(reminder.title)}
                title={t.engagement.alreadyPaidLabel(reminder.title)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-tinta-suave hover:bg-tinta/10"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Last 7 days spending compared against the previous 7 days. */
export function WeeklySummaryCard({ w, locale = 'pt-BR' }: { w: WeeklyResponse; locale?: Locale }) {
  if (!w.spentInCents && !w.prevSpentInCents && !w.missionsDone) return null;
  const t = getDictionary(locale);
  const diffInCents = w.spentInCents - w.prevSpentInCents;
  const isLowerOrEqual = diffInCents <= 0;

  return (
    <Link
      href="/carteira?filtro=saidas#lista"
      id="semana"
      className="flex scroll-mt-4 flex-col gap-2 rounded-2xl bg-azul p-3.5 pr-10 text-tinta no-underline"
    >
      <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
        {t.engagement.yourWeekLabel}
      </span>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-[28px] leading-8 font-extrabold tabular-nums">{money(w.spentInCents)}</span>
        {w.prevSpentInCents > 0 && (
          <span
            className={`rounded-full px-2.5 py-1 text-[13px] font-bold ${isLowerOrEqual ? 'bg-menta text-tinta-fixa' : 'bg-rosa'}`}
          >
            {isLowerOrEqual ? '↓' : '↑'} {money(Math.abs(diffInCents))}
          </span>
        )}
      </div>
      <p className="text-[14px] leading-5">
        {w.prevSpentInCents > 0
          ? isLowerOrEqual
            ? t.engagement.lessThanPrevWeek(money(w.prevSpentInCents))
            : t.engagement.moreThanPrevWeek(money(w.prevSpentInCents))
          : t.engagement.nextWeekCompare}
        {w.top && <span>{t.engagement.topCategoryLabel(w.top.name, money(w.top.totalInCents))}</span>}{' '}
        {t.engagement.missionsDoneCount(w.missionsDone)}
      </p>
    </Link>
  );
}

/** Projected leftover/shortfall by the end of the current month (the card is about this month only). */
export function MonthLeftoverCard({ forecast, locale = 'pt-BR' }: { forecast: ForecastResponse; locale?: Locale }) {
  const current = forecast.thisMonth;
  if (!current) return null;
  const t = getDictionary(locale);
  const isPositive = current.leftInCents >= 0;
  const upcomingBillsCents = current.fixedLeftInCents + current.subscriptionsLeftInCents;

  return (
    <Link
      href="/previsao"
      className={`flex items-center gap-3 rounded-2xl p-3.5 text-tinta no-underline ${isPositive ? 'bg-menta-clara' : 'bg-rosa'}`}
    >
      <div className="flex grow flex-col gap-1">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
          {t.engagement.untilEndOfMonth(monthName(current.month, locale))}
        </span>
        <span className="text-[15px] leading-[21px]">
          {isPositive ? (
            <>
              {t.engagement.shouldHaveLeftPrefix}{' '}
              <b className="font-display text-[22px] font-extrabold">{money(current.leftInCents)}</b>
            </>
          ) : (
            <>
              {t.engagement.shouldBeShortPrefix}{' '}
              <b className="font-display text-[22px] font-extrabold">{money(-current.leftInCents)}</b>
            </>
          )}
        </span>
        <span className="text-[13px] text-tinta-suave">
          {t.engagement.daysAheadAndSpent(
            current.daysLeft,
            money(current.spentInCents),
            upcomingBillsCents > 0 ? money(upcomingBillsCents) : null,
          )}
        </span>
      </div>
      {chevronIcon}
    </Link>
  );
}

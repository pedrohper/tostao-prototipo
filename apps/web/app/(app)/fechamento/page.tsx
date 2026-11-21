import { PageVisitTracker } from '@/components/visita';
import Link from 'next/link';
import type {
  LessonProgressResponse,
  MonthSummaryResponse,
  SubscriptionsResponse,
  TransactionDTO,
} from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth, money, monthName, resolveBackHref, shiftMonth } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { NO_PROGRESS, xpFrom } from '@/lib/xp';
import { ShareButton } from './share-button';
import { Cartas } from './cartas';

const pct = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);

function Delta({
  now,
  before,
  goodWhenDown = true,
  t,
}: {
  now: number;
  before: number;
  goodWhenDown?: boolean;
  t: Dictionary['pages']['fechamento'];
}) {
  const p = pct(now, before);
  if (p === null || p === 0) return <span className="text-xs text-tinta-suave">{t.equalPrev}</span>;
  const good = goodWhenDown ? p < 0 : p > 0;
  return (
    <span className={`text-xs font-semibold ${good ? 'text-verde-texto' : 'text-vermelho-texto'}`}>
      {p > 0 ? '▲' : '▼'} {t.vsPrev(Math.abs(p))}
    </span>
  );
}

const white = 'rounded-[18px] bg-papel-fixo p-3.5 text-tinta-fixa';

/** Fechamento: o mês que passou em cartas, no laranja do design. Padrão: o último mês fechado. */
export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; voltar?: string }>;
}) {
  const [{ mes, voltar }, { locale, t }] = await Promise.all([searchParams, getI18n()]);
  const f = t.pages.fechamento;
  const month = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : shiftMonth(currentMonth(), -1);
  const before = shiftMonth(month, -1);
  const backHref = resolveBackHref(voltar, '/carteira?aba=planejar');
  const mesHref = (m: string) =>
    voltar ? `/fechamento?mes=${m}&voltar=${encodeURIComponent(backHref)}` : `/fechamento?mes=${m}`;
  const selfHref = mesHref(month);

  const [s, p, { transactions }, subs, progress] = await Promise.all([
    api<MonthSummaryResponse>(`/summary?month=${month}`),
    api<MonthSummaryResponse>(`/summary?month=${before}`),
    api<{ transactions: TransactionDTO[] }>(`/transactions?month=${month}`),
    api<SubscriptionsResponse>('/subscriptions').catch(() => null),
    api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
  ]);

  const sobrou = s.incomeInCents - s.outcomeInCents;
  const biggest = transactions
    .filter((t) => t.amountInCents < 0 && !t.isInternalTransfer)
    .sort((a, b) => a.amountInCents - b.amountInCents)[0];
  const prevByCat = new Map(p.byCategory.map((c) => [c.categoryId, c.totalInCents]));
  const top = s.byCategory.filter((c) => c.categoryId).slice(0, 4);
  const lider = top[0];
  const share = lider && s.outcomeInCents ? Math.round((lider.totalInCents / s.outcomeInCents) * 100) : 0;
  const vezes = lider ? transactions.filter((t) => t.categoryId === lider.categoryId && t.amountInCents < 0).length : 0;
  const vazio = s.incomeInCents === 0 && s.outcomeInCents === 0;
  const nome = monthName(month, locale);
  const isCurrent = month === currentMonth();
  const titulo = sobrou >= 0 ? (share >= 40 ? f.titleGreenWithBut : f.titleGreen) : f.titleRed;
  const { xp } = xpFrom(progress.done.length, progress.bonusXp);
  const apostas = s.byCategory.find((c) => c.categoryId === 'apostas')?.totalInCents ?? 0;

  const resumo = (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <div className={`${white} flex flex-col gap-0.5`}>
          <span className="text-xs font-semibold text-tinta-fixa/65">{f.inLabel}</span>
          <span className="font-display text-[22px] font-extrabold tabular-nums">{money(s.incomeInCents)}</span>
          <Delta now={s.incomeInCents} before={p.incomeInCents} goodWhenDown={false} t={f} />
        </div>
        <div className={`${white} flex flex-col gap-0.5`}>
          <span className="text-xs font-semibold text-tinta-fixa/65">{f.outLabel}</span>
          <span className="font-display text-[22px] font-extrabold tabular-nums">{money(s.outcomeInCents)}</span>
          <Delta now={s.outcomeInCents} before={p.outcomeInCents} t={f} />
        </div>
      </div>
      {lider && (
        <div className="flex flex-col gap-1.5 rounded-[20px] bg-tinta-fixa p-4 text-papel-fixo">
          <span className="text-xs font-bold tracking-[0.08em] text-amarelo uppercase">{f.topDrainTitle}</span>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-[28px] font-extrabold">{lider.name}</span>
            <span className="font-display text-2xl font-extrabold tabular-nums">{money(lider.totalInCents)}</span>
          </div>
          <span className="text-sm leading-5 text-papel-fixo/80">
            {f.topDrainSub(vezes, share, sobrou >= 0 && share >= 40)}
          </span>
        </div>
      )}
      <div className={`${white} flex items-center gap-2 py-3 pl-1.5`}>
        <Mascot pose="tigrinho" size={72} alt="Tigrinho" />
        <div className="flex flex-col">
          <span className="text-[15px] font-bold">
            {apostas === 0 ? f.villainDefeated : f.tigrinhoTook(money(apostas))}
          </span>
          <span className="text-[13px] leading-[18px] text-tinta-fixa/65">
            {apostas === 0 ? f.noBetsNote : f.betsWarningNote}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <div className="flex flex-col rounded-2xl bg-amarelo-claro px-1.5 py-2.5 text-tinta">
          <span className="font-display text-2xl font-extrabold">{progress.streakDays}</span>
          <span className="text-xs font-semibold">{f.streakDaysLabel}</span>
        </div>
        <div className="flex flex-col rounded-2xl bg-menta-clara px-1.5 py-2.5 text-tinta">
          <span className="font-display text-2xl font-extrabold">{progress.done.length}</span>
          <span className="text-xs font-semibold">{f.lessonsCountLabel(progress.done.length)}</span>
        </div>
        <div className="flex flex-col rounded-2xl bg-azul px-1.5 py-2.5 text-tinta">
          <span className="font-display text-2xl font-extrabold">+{xp}</span>
          <span className="text-xs font-semibold">{f.xpLabel}</span>
        </div>
      </div>
    </>
  );

  const cartas: React.ReactNode[] = [resumo];
  cartas.push(
    <>
      <div className={`${white} flex flex-col gap-1 py-5`}>
        <span className="text-sm font-semibold text-tinta-fixa/65">
          {sobrou >= 0 ? f.leftoverIn(nome) : f.shortIn(nome)}
        </span>
        <span
          className={`font-display text-[44px] leading-none font-extrabold tabular-nums ${sobrou >= 0 ? 'text-verde-texto' : 'text-vermelho-texto'}`}
        >
          {money(Math.abs(sobrou))}
        </span>
        <span className="text-sm leading-5 text-tinta-fixa/65">{sobrou >= 0 ? f.leftoverNote : f.shortNote}</span>
      </div>
      <Link
        href={`/meta?voltar=${encodeURIComponent(selfHref)}`}
        className={`${white} flex items-center gap-2 py-3 pl-1.5 no-underline`}
      >
        <Mascot pose={sobrou >= 0 ? 'comemorando' : 'pensando'} size={64} alt="" />
        <span className="text-sm leading-5">
          {sobrou >= 0 ? (
            <>
              {f.saveForGoalBefore}
              <b>{f.saveForGoalBold}</b>
              {f.saveForGoalAfter}
            </>
          ) : (
            <>
              {f.buildGoalBefore}
              <b>{f.saveForGoalBold}</b>
              {f.buildGoalAfter}
            </>
          )}
        </span>
      </Link>
    </>,
  );
  if (top.length > 1)
    cartas.push(
      <div className={`${white} flex flex-col`}>
        <span className="mb-1 text-xs font-semibold tracking-[0.08em] text-tinta-fixa/65 uppercase">
          {f.whereItWentTitle}
        </span>
        {top.map((c) => (
          <div
            key={c.categoryId}
            className="flex items-center justify-between gap-3 border-b border-tinta-fixa/15 py-2.5 last:border-b-0"
          >
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold">{c.name}</span>
              <Delta now={c.totalInCents} before={prevByCat.get(c.categoryId) ?? 0} t={f} />
            </div>
            <span className="font-bold tabular-nums">{money(c.totalInCents)}</span>
          </div>
        ))}
      </div>,
    );
  if (biggest)
    cartas.push(
      <>
        <div className={`${white} flex flex-col gap-1 py-4`}>
          <span className="text-xs font-semibold tracking-[0.08em] text-tinta-fixa/65 uppercase">
            {f.biggestExpenseTitle}
          </span>
          <span className="font-display text-[34px] leading-none font-extrabold tabular-nums">
            {money(-biggest.amountInCents)}
          </span>
          <span className="font-semibold [overflow-wrap:anywhere]">{biggest.description}</span>
        </div>
        <Mascot pose="chocado" size={140} alt="Tostão" className="self-center" />
      </>,
    );
  if (subs && subs.monthlyInCents > 0)
    cartas.push(
      <Link
        href={`/assinaturas?voltar=${encodeURIComponent(selfHref)}`}
        className={`${white} flex flex-col items-center gap-2 py-6 text-center no-underline`}
      >
        <Mascot pose="investigando" size={110} alt="" />
        <span className="font-display text-[30px] leading-none font-extrabold tabular-nums">
          {money(subs.monthlyInCents)}
        </span>
        <span className="text-sm leading-5">{f.subsPerMonthNote}</span>
      </Link>,
    );

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-laranja text-tinta-fixa md:static md:inset-auto md:z-auto md:mx-auto md:my-2 md:w-full md:max-w-[760px] md:overflow-visible md:rounded-[28px] md:shadow-[0_12px_36px_rgba(30,27,24,0.12)]">
      <PageVisitTracker kind="visita:fechamento" />
      <div className="mx-auto flex min-h-full max-w-[520px] flex-col gap-3.5 px-5 pt-11 pb-7 md:min-h-[620px] md:max-w-none md:p-8">
        {vazio ? (
          <>
            <div className="flex items-center justify-between">
              <img src="/wordmark.png" alt="Tostão" className="h-auto w-[92px]" />
              <Link
                href={backHref}
                aria-label={t.common.close}
                className="-mr-2.5 flex h-11 w-11 items-center justify-center text-tinta-fixa"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </Link>
            </div>

            <div className="-mb-2 flex items-center gap-1">
              <Link
                href={mesHref(before)}
                aria-label={f.prevMonth}
                className="-ml-2 flex h-9 w-9 items-center justify-center text-tinta-fixa"
              >
                ‹
              </Link>
              <span className="text-sm font-bold">
                {f.yourMonthLabel(nome, isCurrent, vazio, month.slice(0, 4), cartas.length)}
              </span>
              {!isCurrent && (
                <Link
                  href={mesHref(shiftMonth(month, 1))}
                  aria-label={f.nextMonth}
                  className="flex h-9 w-9 items-center justify-center text-tinta-fixa"
                >
                  ›
                </Link>
              )}
            </div>

            <div className={`${white} flex flex-col items-center gap-3 py-8 text-center`}>
              <Mascot pose="dormindo" size={150} alt="Tostão" />
              <p className="text-[15px] text-tinta-fixa/65">{f.emptyMonthNote(nome)}</p>
            </div>
            <div className="grow" />
            <Link
              href={backHref}
              className="flex h-[52px] items-center justify-center rounded-full bg-tinta-fixa text-[15px] font-bold text-papel-fixo no-underline"
            >
              {t.common.back}
            </Link>
          </>
        ) : (
          <Cartas
            cartas={cartas}
            share={
              <ShareButton
                text={f.shareText(nome, titulo.toLowerCase())}
                shareLabel={f.shareBtn}
                copiedLabel={f.copiedBtn}
              />
            }
            locale={locale}
            header={
              <>
                <div className="flex items-center justify-between">
                  <img src="/wordmark.png" alt="Tostão" className="h-auto w-[92px]" />
                  <Link
                    href={backHref}
                    aria-label={t.common.close}
                    className="-mr-2.5 flex h-11 w-11 items-center justify-center text-tinta-fixa"
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </Link>
                </div>

                <div className="-mb-2 flex items-center gap-1">
                  <Link
                    href={mesHref(before)}
                    aria-label={f.prevMonth}
                    className="-ml-2 flex h-9 w-9 items-center justify-center text-tinta-fixa"
                  >
                    ‹
                  </Link>
                  <span className="text-sm font-bold">
                    {f.yourMonthLabel(nome, isCurrent, vazio, month.slice(0, 4), cartas.length)}
                  </span>
                  {!isCurrent && (
                    <Link
                      href={mesHref(shiftMonth(month, 1))}
                      aria-label={f.nextMonth}
                      className="flex h-9 w-9 items-center justify-center text-tinta-fixa"
                    >
                      ›
                    </Link>
                  )}
                </div>

                <h1 className="font-display text-[40px] leading-[42px] font-extrabold">{titulo}</h1>
              </>
            }
          />
        )}
      </div>
    </div>
  );
}

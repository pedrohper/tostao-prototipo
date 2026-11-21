import type { BattlesResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import type { Locale } from '@/lib/i18n';
import { Mascot } from '@/components/mascote';
import { BackLink, PageFrame } from '@/components/ui';
import { Confetti } from '@/components/confete';
import { startTigrinho, toggleUrubuStep } from './actions';

const dia = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' });
const branco = 'flex flex-col gap-2.5 rounded-[18px] bg-cartao px-4 py-3.5 text-tinta';

/** Batalha contra o Tigrinho: 30 dias sem bet, conferido no extrato. Depois, o Urubu do Pix. */
export default async function BatalhaPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [{ voltar }, b, { locale, t: dict }] = await Promise.all([
    searchParams,
    api<BattlesResponse>('/battles'),
    getI18n(),
  ]);
  const tb = dict.pages.batalha;
  const t = b.tigrinho;
  const status = t?.status ?? 'nova';
  const vida = t
    ? t.status === 'vencida'
      ? 0
      : t.status === 'perdida'
        ? 100
        : Math.round(((t.totalDays - t.day + 1) / t.totalDays) * 100)
    : 100;
  const titulo = status === 'vencida' ? tb.titleWon : status === 'perdida' ? tb.titleLost : tb.titleNew;
  const backHref = resolveBackHref(voltar, '/aprender');

  return (
    <PageFrame size="focused">
      <div className="-mx-5 -mt-6 -mb-28 flex min-h-[calc(100dvh-5rem)] flex-col gap-2.5 bg-amarelo-claro px-5 pt-5 pb-20 text-tinta sm:gap-3.5 md:mx-0 md:mt-0 md:mb-0 md:min-h-0 md:rounded-[28px] md:border md:border-linha md:p-6 md:pb-8">
        {status === 'vencida' && b.urubu.status !== 'vencida' && <Confetti />}
        <div className="flex items-center justify-between">
          <BackLink href={backHref} label={dict.common.back} />
          <span className="text-xs font-bold tracking-[0.08em] text-laranja-texto uppercase">
            {t && status === 'ativa' ? tb.battleDayLabel(t.day, t.totalDays) : tb.battleLabel}
          </span>
        </div>
        <h1 className="font-display text-[24px] sm:text-[28px] leading-7 sm:leading-8 font-extrabold">{titulo}</h1>

        <div className="relative flex h-[140px] sm:h-[180px] md:h-[210px] items-end justify-between">
          <Mascot
            pose={status === 'perdida' ? 'caramelo-dormindo' : 'caramelo-bravo'}
            size={120}
            alt="Caramelo"
            className="h-[110px] w-[110px] sm:h-[140px] sm:w-[140px] md:h-[160px] md:w-[160px] object-contain"
          />
          <span className="absolute top-[40px] sm:top-[60px] md:top-[70px] left-1/2 -translate-x-1/2 -rotate-6 font-display text-[26px] sm:text-[30px] md:text-[34px] font-extrabold text-laranja [-webkit-text-stroke:1.5px_var(--color-tinta-fixa)]">
            VS
          </span>
          <img
            src="/elenco/tigrinho.webp"
            alt="Tigrinho"
            width={190}
            height={190}
            className={`shrink-0 h-[125px] w-[125px] sm:h-[160px] sm:w-[160px] md:h-[190px] md:w-[190px] object-contain ${status === 'vencida' ? 'rotate-12 opacity-40 grayscale' : 'mascote'}`}
          />
        </div>

        {t && status !== 'nova' && (
          <div className={branco}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold">{tb.tigrinhoHealth}</span>
              <span className="text-[13px] font-semibold text-tinta-suave">{tb.remainingPct(vida)}</span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-papel-2">
              <div className="bar-fill h-full rounded-full bg-laranja" style={{ width: `${vida}%` }} />
            </div>
            <div
              className="grid grid-cols-10 gap-[5px]"
              role="img"
              aria-label={tb.progressAria(status === 'vencida' ? t.totalDays : t.day - 1, t.totalDays)}
            >
              {Array.from({ length: t.totalDays }, (_, i) => {
                const feito = status === 'vencida' || i < t.day - 1;
                const hoje = status === 'ativa' && i === t.day - 1;
                return (
                  <i
                    key={i}
                    className={`aspect-square rounded-full ${feito ? 'bg-menta' : hoje ? 'border-2 border-tinta' : status === 'perdida' && i === t.day - 1 ? 'bg-alerta' : 'bg-papel-2'}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {status === 'nova' && (
          <div className={branco}>
            <p className="text-[15px] leading-[22px]">
              {tb.introBefore}
              <b>{tb.introBold}</b>
              {tb.introAfter}
            </p>
            <p className="text-[13px] leading-[18px] text-tinta-suave">{tb.introSub}</p>
          </div>
        )}

        {t && status !== 'nova' && (
          <div className="flex items-start gap-2.5 rounded-[18px] bg-cartao px-3.5 py-3 text-tinta">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-tinta ${status === 'perdida' ? 'bg-rosa' : 'bg-menta-clara'}`}
            >
              {status === 'perdida' ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
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
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
            <p className="text-sm leading-5">
              {status === 'perdida' && t.lostAt ? (
                <>
                  <b>{tb.lostNoticeBold}</b>
                  {tb.lostNoticeAfter(dia(t.lostAt, locale))}
                </>
              ) : !b.checksStatement ? (
                <>
                  <b>{tb.noBankBold}</b>
                  {tb.noBankAfter}
                </>
              ) : status === 'vencida' ? (
                <>
                  <b>{tb.wonNoticeBold}</b>
                  {tb.wonNoticeAfter}
                </>
              ) : (
                <>
                  <b>{tb.activeNoticeBold}</b>
                  {tb.activeNoticeAfter(dia(t.startedAt, locale))}
                </>
              )}
            </p>
          </div>
        )}

        {(status === 'nova' || status === 'perdida') && (
          <form action={startTigrinho}>
            <button
              type="submit"
              className="flex h-[54px] w-full items-center justify-center rounded-full bg-laranja text-base font-bold text-tinta-fixa shadow-[0_2px_0_rgba(30,27,24,0.14)]"
            >
              {status === 'nova' ? tb.acceptBattle : tb.restartDay1}
            </button>
          </form>
        )}

        <div className="grow" />
        <section className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
            {b.urubu.status === 'bloqueada' ? tb.nextBattle : tb.battle2}
          </span>
          <div className="flex flex-col rounded-2xl bg-cartao text-tinta">
            <div className="flex items-center gap-2 py-2 pr-3.5 pl-1.5">
              <Mascot
                pose={b.urubu.status === 'vencida' ? 'urubu-fugindo' : 'urubu-pix'}
                size={52}
                alt={tb.urubuTitle}
                still
              />
              <div className="flex grow flex-col">
                <span className="text-[15px] font-bold">
                  {tb.urubuTitle}
                  {b.urubu.status === 'vencida' ? tb.defeatedSuffix : ''}
                </span>
                <span className="text-xs text-tinta-suave">{tb.urubuSub}</span>
              </div>
              {b.urubu.status === 'bloqueada' && (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  role="img"
                  aria-label={tb.lockedAria}
                  className="text-tinta-suave"
                >
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              )}
            </div>
            {b.urubu.status !== 'bloqueada' &&
              b.urubu.steps.map((s) => (
                <form key={s.id} action={toggleUrubuStep} className="border-t border-linha">
                  <input type="hidden" name="stepId" value={s.id} />
                  <input type="hidden" name="done" value={String(!s.done)} />
                  <button
                    type="submit"
                    aria-pressed={s.done}
                    className="flex min-h-12 w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm leading-5"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] ${s.done ? 'border-menta bg-menta text-tinta-fixa' : 'border-linha'}`}
                      aria-hidden="true"
                    >
                      {s.done && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                    </span>
                    <span className={s.done ? 'text-tinta-suave line-through' : ''}>{s.label}</span>
                  </button>
                </form>
              ))}
          </div>
        </section>
      </div>
    </PageFrame>
  );
}

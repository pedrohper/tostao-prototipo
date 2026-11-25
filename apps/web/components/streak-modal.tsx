'use client';

import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { MissionsResponse } from '@tostao/contracts';
import { Icon } from './icone';
import { getDictionary, type Locale } from '@/lib/i18n';
import { useDialogA11y } from '@/lib/use-dialog-a11y';

function StreakDialog({
  open,
  onClose,
  days,
  missions,
  locale = 'pt-BR',
}: {
  open: boolean;
  onClose: () => void;
  days: number;
  missions: MissionsResponse | null;
  locale?: Locale;
}) {
  const t = getDictionary(locale);

  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const weekId = useId();
  // Focus trap, Esc, scroll-lock e retorno do foco; o foco inicial vai pro botão de fechar.
  useDialogA11y({ open, containerRef: panel, onClose, initialFocusRef: closeButton });

  if (!open || typeof document === 'undefined') return null;

  const streakDays = missions?.streakDays ?? days;
  const completedCount = missions?.missions.filter((m) => m.done).length ?? 0;
  const totalCount = missions?.missions.length ?? 0;
  const allDone = totalCount > 0 && completedCount === totalCount;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-[440px] flex-col gap-5 overflow-y-auto rounded-[26px] border border-linha bg-cartao p-6 text-tinta shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amarelo-claro">
              <Icon src="ui/ofensiva" size={28} />
            </span>
            <div className="flex flex-col">
              <h2 id={titleId} className="font-display text-2xl leading-7 font-extrabold">
                {t.nav.streakDays(streakDays)}
              </h2>
              <span className="text-[13px] text-tinta-suave">
                {missions?.todayKept ? t.engagement.streakKeptHint : t.engagement.oneMissionHint}
              </span>
            </div>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-papel-2 text-tinta-suave transition-colors hover:text-tinta"
          >
            <svg
              width="16"
              height="16"
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
        </div>

        {missions && missions.week.length > 0 && (
          <div className="flex flex-col gap-2.5 rounded-2xl bg-papel-2/70 p-4">
            <span id={weekId} className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
              {locale === 'en' ? '7-day sequence' : locale === 'es' ? 'Secuencia de 7 días' : 'Sequência de 7 dias'}
            </span>
            <div className="flex items-center justify-between gap-1.5" role="group" aria-labelledby={weekId}>
              {missions.week.map((dayItem, idx) => {
                const active = dayItem.done > 0;
                return (
                  <span
                    key={dayItem.day}
                    className="flex flex-col items-center gap-1.5 text-[12px] font-semibold text-tinta-suave"
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                        active
                          ? 'border-laranja/30 bg-laranja text-tinta-fixa'
                          : 'border-dashed border-linha bg-cartao text-tinta-suave'
                      }`}
                    >
                      {active ? <Icon src="ui/ofensiva" size={18} /> : <span className="text-[12px]">·</span>}
                    </span>
                    <span className={active ? 'font-bold text-tinta' : ''}>{t.weekdaysShort[idx]}</span>
                    <span className="sr-only">{active ? t.system.stepDone : t.system.stepPending}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {missions && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
                {t.engagement.todayMissionsLabel(completedCount, totalCount).replace(/\s*›$/, '')}
              </span>
              {allDone && (
                <span className="rounded-full bg-menta-clara px-2.5 py-0.5 text-[12px] font-bold text-verde-texto">
                  {t.engagement.allDoneTitle}
                </span>
              )}
            </div>
            <ul className="flex flex-col divide-y divide-linha rounded-2xl border border-linha bg-cartao px-4">
              {missions.missions.map((mission) => (
                <li key={mission.id}>
                  <Link
                    href={mission.href}
                    onClick={onClose}
                    className="flex min-h-[52px] items-center gap-3 py-2.5 text-tinta no-underline transition-opacity hover:opacity-80"
                  >
                    {mission.done ? (
                      <Icon src="jogo/dia-cumprido" size={24} alt={t.system.stepDone} />
                    ) : (
                      <span
                        role="img"
                        aria-label={t.system.stepPending}
                        className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-tinta-suave"
                      />
                    )}
                    <span
                      className={`grow text-[15px] ${mission.done ? 'text-tinta-suave line-through' : 'font-semibold'}`}
                    >
                      {mission.title}
                    </span>
                    {!mission.done && (
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
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Foguinho: no mobile/tablet abre a página /ofensiva; no web desktop (lg+) abre modal via Portal. */
export function StreakModalButton({
  days,
  missions,
  locale = 'pt-BR',
  label,
  backHref = '/inicio',
}: {
  days: number;
  missions: MissionsResponse | null;
  locale?: Locale;
  label?: string;
  backHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = getDictionary(locale);
  const effectiveDays = missions?.streakDays ?? days;
  const ariaLabel = label ?? t.nav.streakDays(effectiveDays);

  return (
    <>
      <Link
        href={`/ofensiva?voltar=${encodeURIComponent(backHref)}`}
        aria-label={ariaLabel}
        className="flex items-center gap-1 rounded-full bg-amarelo-claro px-3 py-1.5 text-sm font-bold text-tinta no-underline transition hover:brightness-95 lg:hidden"
      >
        <Icon src="ui/ofensiva" size={18} />
        <span className="tabular-nums">{effectiveDays}</span>
      </Link>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        className="hidden items-center gap-1 rounded-full bg-amarelo-claro px-3 py-1.5 text-sm font-bold text-tinta transition hover:brightness-95 lg:flex"
      >
        <Icon src="ui/ofensiva" size={18} />
        <span className="tabular-nums">{effectiveDays}</span>
      </button>
      <StreakDialog
        open={open}
        onClose={() => setOpen(false)}
        days={effectiveDays}
        missions={missions}
        locale={locale}
      />
    </>
  );
}

/** Card da barra lateral (desktop) clicável para abrir ofensiva + missões de hoje em modal via Portal. */
export function SidebarStreakButton({
  xp,
  level,
  streakDays,
  missions,
  locale = 'pt-BR',
}: {
  xp: number;
  level: number;
  streakDays: number;
  missions: MissionsResponse | null;
  locale?: Locale;
}) {
  const [open, setOpen] = useState(false);
  const t = getDictionary(locale);
  const effectiveDays = missions?.streakDays ?? streakDays;
  const xpRemaining = level * 100 - xp;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full flex-col gap-2 rounded-2xl bg-amarelo-claro p-3.5 text-left text-tinta transition hover:brightness-95"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-2 text-[13px] font-bold">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Icon src="ui/ofensiva" size={16} />
            {t.nav.streakDays(effectiveDays)}
          </span>
          <span className="whitespace-nowrap">{xp} XP</span>
        </div>
        <div className="h-2 w-full rounded-full bg-cartao">
          <div className="h-full rounded-full bg-tinta" style={{ width: `${Math.max(4, xp % 100)}%` }} />
        </div>
        <span className="text-xs text-tinta-suave">{t.nav.xpToNextLevel(xpRemaining, level + 1)}</span>
      </button>
      <StreakDialog
        open={open}
        onClose={() => setOpen(false)}
        days={effectiveDays}
        missions={missions}
        locale={locale}
      />
    </>
  );
}

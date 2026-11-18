'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icone';

export type PlannerBadgeTone = 'neutral' | 'positive' | 'warning' | 'alert';

export interface PlannerCardViewItem {
  id: string;
  href: string;
  icon: string;
  iconBg: string;
  title: string;
  moreInfoAria?: string;
  headline: string | null;
  summary: string;
  badge?: { text: string; tone: PlannerBadgeTone };
  progressPct?: number | null;
}

const BADGE_CLASSES: Record<PlannerBadgeTone, string> = {
  neutral: 'bg-papel-2 text-tinta-suave',
  positive: 'bg-menta-clara text-verde-texto',
  warning: 'bg-amarelo-claro text-tinta',
  alert: 'bg-rosa text-vermelho-texto',
};

export function PlannerCardGrid({ cards, openCardLabel }: { cards: PlannerCardViewItem[]; openCardLabel: string }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {cards.map((card) => {
        const isOpen = openId === card.id;
        return (
          <div
            key={card.id}
            className="flex min-w-0 flex-col rounded-[22px] border border-linha bg-cartao transition-colors hover:border-tinta/35"
          >
            <div className="relative flex min-h-[76px] items-center justify-between gap-2.5 p-4">
              <Link href={card.href} aria-label={card.title} className="absolute inset-0 rounded-[22px]" />
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}
                  aria-hidden="true"
                >
                  <Icon src={card.icon} size={22} />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-bold text-tinta">{card.title}</span>
                  {card.headline && (
                    <span className="truncate font-display text-[17px] leading-6 font-extrabold text-tinta tabular-nums">
                      {card.headline}
                    </span>
                  )}
                </div>
              </div>

              <div className="relative z-[1] flex shrink-0 items-center gap-1">
                {card.badge && (
                  <span
                    className={`pointer-events-none rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${BADGE_CLASSES[card.badge.tone]}`}
                  >
                    {card.badge.text}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenId((prev) => (prev === card.id ? null : card.id));
                  }}
                  aria-expanded={isOpen}
                  aria-label={card.moreInfoAria ?? card.title}
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors after:absolute after:-inset-1 after:content-[''] ${
                    isOpen ? 'bg-papel-2 text-tinta' : 'text-tinta-suave hover:bg-papel-2 hover:text-tinta'
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.75" />
                    <circle cx="12" cy="12" r="1.75" />
                    <circle cx="19" cy="12" r="1.75" />
                  </svg>
                </button>
              </div>
            </div>

            {card.progressPct !== undefined && card.progressPct !== null && (
              <div className="px-4 pb-3.5">
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-papel-2"
                  role="progressbar"
                  aria-valuenow={card.progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={card.title}
                >
                  <div
                    className="h-full rounded-full bg-menta transition-all"
                    style={{ width: `${Math.max(4, card.progressPct)}%` }}
                  />
                </div>
              </div>
            )}

            {isOpen && (
              <div className="flex items-center justify-between gap-3 border-t border-linha bg-papel-2/50 px-4 py-3 text-[13px] leading-[18px] text-tinta-suave">
                <p className="min-w-0">{card.summary}</p>
                <Link
                  href={card.href}
                  className="shrink-0 rounded-full bg-tinta px-3 py-1.5 text-xs font-semibold text-papel no-underline"
                >
                  {openCardLabel} ›
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

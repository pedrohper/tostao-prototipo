'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icone';
import { Mascot } from '@/components/mascote';
import { getDictionary, type Locale } from '@/lib/i18n';
import type { Module } from '@/lib/lessons';
import { BOOK_THEMES, getStoryPageMeta } from '@/lib/story-cast';

type Props = {
  modules: Module[];
  initialBookId: string;
  currentBookId: string | null;
  done: string[];
  pageAssets: Record<string, string>;
  locale: Locale;
};

export function BookCarousel({ modules, initialBookId, currentBookId, done, pageAssets, locale }: Props) {
  const t = getDictionary(locale);
  const th = t.pages.learnExtra.hub;
  const [selectedBookId, setSelectedBookId] = useState(initialBookId);
  const book = modules.find((m) => m.id === selectedBookId) ?? modules[0]!;
  const theme = BOOK_THEMES[book.number] ?? BOOK_THEMES[1]!;

  const firstUndoneIdx = book.lessons.findIndex((l) => !done.includes(l.id));
  const currentUnlockedIdx = firstUndoneIdx >= 0 ? firstUndoneIdx : 0;
  const doneInBook = book.lessons.filter((l) => done.includes(l.id)).length;

  const [activeSlide, setActiveSlide] = useState(currentUnlockedIdx);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  const scrollToSlide = (idx: number, behavior: ScrollBehavior = 'smooth') => {
    const clamped = Math.max(0, Math.min(book.lessons.length - 1, idx));
    setActiveSlide(clamped);
    const card = cardRefs.current[clamped];
    if (card) {
      card.scrollIntoView({ behavior, inline: 'center', block: 'nearest' });
    }
  };

  useEffect(() => {
    const targetIdx = firstUndoneIdx >= 0 ? firstUndoneIdx : 0;
    const timer = setTimeout(() => {
      scrollToSlide(targetIdx, 'auto');
    }, 30);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookId]);

  const handleTrackScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const trackCenter = track.scrollLeft + track.clientWidth / 2;
    let bestIdx = 0;
    let bestDist = Infinity;
    cardRefs.current.forEach((el, idx) => {
      if (!el) return;
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(trackCenter - elCenter);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    setActiveSlide(bestIdx);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Seletor compacto dos 9 livros */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {modules.map((m) => {
          const mDone = m.lessons.filter((l) => done.includes(l.id)).length;
          const mComplete = mDone === m.lessons.length;
          const isSelected = m.id === book.id;
          const isCurrent = m.id === currentBookId;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedBookId(m.id)}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${
                isSelected
                  ? 'border-tinta bg-tinta text-papel'
                  : mComplete
                    ? 'border-menta bg-menta-clara text-verde-texto hover:opacity-90'
                    : isCurrent
                      ? 'border-laranja bg-amarelo-claro text-tinta hover:opacity-90'
                      : 'border-linha bg-cartao text-tinta-suave opacity-70 hover:opacity-100'
              }`}
            >
              <span>L{m.number}</span>
              {mComplete && <span aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Cabeçalho do livro aberto */}
      <div className="flex flex-col gap-2 rounded-[22px] border border-linha bg-cartao p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-linha/70 ${theme.bgClass}`}
            >
              <Icon src={`modulo/${book.number}`} size={24} alt={t.pages.learnExtra.moduleAlt(book.number)} />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className={`text-[11px] font-extrabold tracking-[0.06em] uppercase ${theme.accentTextClass}`}>
                {th.bookOfTotal(book.number, modules.length)}
                {book.optional ? th.optionalSuffix : ''}
              </span>
              <h2 className="truncate font-display text-[19px] leading-[24px] font-extrabold text-tinta sm:text-[21px]">
                {book.title}
              </h2>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-papel-2 px-2.5 py-1 text-xs font-bold text-tinta tabular-nums">
            {doneInBook}/{book.lessons.length}
          </span>
        </div>
        <p className="text-[13px] leading-[19px] text-tinta-suave">{book.goal}</p>
        <div
          className="flex w-full gap-1.5 pt-0.5"
          role="img"
          aria-label={t.learn.moduleCounter(book.number, doneInBook, book.lessons.length)}
        >
          {book.lessons.map((l, idx) => {
            const isDone = done.includes(l.id);
            const isCurr = idx === currentUnlockedIdx && firstUndoneIdx >= 0;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => scrollToSlide(idx)}
                aria-label={th.pageOfTotal(l.number, book.lessons.length)}
                className={`h-2 grow cursor-pointer rounded-full transition-colors ${
                  isDone ? 'bg-tinta' : isCurr ? 'bg-laranja' : 'bg-papel-2'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Carrossel horizontal das páginas do livro */}
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={handleTrackScroll}
          className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {book.lessons.map((lesson, idx) => {
            const isDone = done.includes(lesson.id);
            const isCurrentPage = firstUndoneIdx >= 0 ? idx === firstUndoneIdx : idx === 0;
            const isLocked = firstUndoneIdx >= 0 && idx > firstUndoneIdx;
            const meta = getStoryPageMeta(lesson.id);
            const customImg = pageAssets[lesson.id];

            return (
              <article
                key={lesson.id}
                ref={(el) => {
                  cardRefs.current[idx] = el;
                }}
                className={`flex shrink-0 snap-center flex-col overflow-hidden rounded-[26px] border bg-cartao transition-all duration-300 ${
                  customImg ? 'w-[78%] max-w-[340px]' : 'w-[86%] sm:w-[76%]'
                } ${
                  isLocked
                    ? 'border-linha/70 opacity-60 grayscale'
                    : isCurrentPage
                      ? 'border-tinta/40 shadow-sm'
                      : 'border-linha'
                }`}
              >
                {/* Ilustração da página do livro */}
                <div
                  className={`relative flex flex-col items-center justify-center overflow-hidden ${
                    customImg ? 'aspect-[3/4] w-full' : 'min-h-[225px] px-5 pt-5 pb-4 sm:min-h-[260px]'
                  } ${isLocked ? 'bg-papel-2' : theme.bgClass}`}
                >
                  {customImg ? (
                    <img
                      src={customImg}
                      alt={lesson.title}
                      className="h-full w-full object-cover select-none"
                      draggable={false}
                    />
                  ) : (
                    <>
                      <div className="pointer-events-none absolute -top-5 -right-5 opacity-10">
                        <Icon src={`modulo/${book.number}`} size={140} />
                      </div>
                      <div className="mt-4 flex items-end justify-center gap-1">
                        {meta.poses.map((pose, pIdx) => (
                          <Mascot
                            key={`${lesson.id}-${pose}-${pIdx}`}
                            pose={pose}
                            size={meta.poses.length > 1 ? 128 : 156}
                            still={isLocked}
                            alt={pIdx === 0 ? `${th.speakers[meta.speaker]} — ${lesson.title}` : ''}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Selo superior esquerdo: número da página */}
                  <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 rounded-full bg-cartao/90 px-3 py-1 text-[11px] font-bold tracking-[0.05em] text-tinta uppercase shadow-xs backdrop-blur-xs">
                    {isLocked ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="4" y="11" width="16" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    ) : (
                      <Icon src={`modulo/${book.number}`} size={13} />
                    )}
                    <span>{th.pageOfTotal(lesson.number, book.lessons.length)}</span>
                  </div>

                  {/* Selo superior direito: personagem ou status */}
                  <div className="absolute top-3.5 right-3.5 rounded-full bg-cartao/90 px-2.5 py-1 text-[11px] font-bold text-tinta shadow-xs backdrop-blur-xs">
                    {isDone ? th.pageDoneBadge : isLocked ? th.pageLockedBadge : th.speakers[meta.speaker]}
                  </div>
                </div>

                {/* Texto e ação da página */}
                <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-tinta-suave">
                      {isLocked ? th.speakers[meta.speaker] : `${th.nextLessonMeta} · ${lesson.simulator.name}`}
                    </span>
                    <h3 className="font-display text-[21px] leading-[26px] font-extrabold text-tinta sm:text-[23px] sm:leading-[28px]">
                      {lesson.title}
                    </h3>
                    <p className="text-[14px] leading-[21px] text-tinta-suave">{lesson.hook}</p>
                  </div>

                  {isLocked ? (
                    <div className="flex flex-col gap-2 pt-1">
                      <p className="text-xs font-medium text-tinta-suave">{th.unlockHint(lesson.number - 1)}</p>
                      <button
                        type="button"
                        onClick={() => scrollToSlide(currentUnlockedIdx)}
                        className="flex h-11 items-center justify-center rounded-full border border-linha bg-papel-2 px-5 text-sm font-semibold text-tinta transition hover:bg-papel"
                      >
                        {th.goToCurrentPage}
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={`/aprender/${lesson.id}`}
                      className={`flex h-12 items-center justify-center rounded-full px-6 text-[15px] font-semibold no-underline transition-opacity hover:opacity-90 ${
                        isDone ? 'border border-tinta bg-cartao text-tinta' : 'bg-tinta text-papel'
                      }`}
                    >
                      {isDone ? th.reviewPageCta : done.length ? t.learn.continueCta : t.learn.startCta}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Controles do carrossel (setas + indicadores + dica de arraste) */}
        <div className="mt-1 flex items-center justify-between gap-2 px-1">
          <span className="text-xs text-tinta-suave">{th.swipeHint}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollToSlide(activeSlide - 1)}
              disabled={activeSlide === 0}
              aria-label={th.prevPageAria}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-linha bg-cartao text-tinta transition hover:bg-papel-2 disabled:opacity-35"
            >
              ‹
            </button>
            <div className="flex items-center gap-1.5">
              {book.lessons.map((l, idx) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => scrollToSlide(idx)}
                  aria-label={th.pageOfTotal(l.number, book.lessons.length)}
                  className={`h-2 rounded-full transition-all ${
                    idx === activeSlide ? 'w-5 bg-tinta' : 'w-2 bg-linha hover:bg-tinta-suave'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => scrollToSlide(activeSlide + 1)}
              disabled={activeSlide >= book.lessons.length - 1}
              aria-label={th.nextPageAria}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-linha bg-cartao text-tinta transition hover:bg-papel-2 disabled:opacity-35"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Botão Ver todos os livros na biblioteca */}
      <Link
        href="/aprender/trilha"
        className="flex h-12 items-center justify-center gap-2 rounded-full border border-linha bg-cartao px-5 text-[15px] font-semibold text-tinta no-underline transition-colors hover:bg-papel-2"
      >
        <span>{th.seeAllModules}</span>
        <span aria-hidden="true" className="text-tinta-suave">
          ›
        </span>
      </Link>
    </div>
  );
}

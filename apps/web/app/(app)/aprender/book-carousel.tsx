'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icone';
import { Mascot } from '@/components/mascote';
import { getDictionary, type Locale } from '@/lib/i18n';
import { BOOK_THEMES, getStoryPageMeta } from '@/lib/story-cast';

/**
 * Só o que o carrossel desenha. O módulo completo (`modules.json`, ~80 KB com todos os textos das lições) NÃO vai pro
 * navegador: o servidor manda este resumo (id, número, título e, por lição, id/número/título/gancho).
 */
export type BookModule = {
  id: string;
  number: number;
  title: string;
  optional: boolean;
  lessons: { id: string; number: number; title: string; hook: string }[];
};

type Props = {
  modules: BookModule[];
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
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
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

  const selectBook = (id: string) => {
    setSelectedBookId(id);
    setBookPickerOpen(false);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Barra compacta do livro atual + troca de livro */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setBookPickerOpen((v) => !v)}
          aria-expanded={bookPickerOpen}
          className="flex w-full min-w-0 items-center gap-2.5 rounded-2xl border border-linha bg-cartao px-3 py-1.5 text-left transition hover:bg-papel-2"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-linha/60 ${theme.bgClass}`}
          >
            <Icon src={`modulo/${book.number}`} size={18} alt={t.pages.learnExtra.moduleAlt(book.number)} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-[10px] font-extrabold tracking-[0.06em] uppercase ${theme.accentTextClass}`}>
              {th.bookOfTotal(book.number, modules.length)} · {doneInBook}/{book.lessons.length}
              {book.optional ? th.optionalSuffix : ''}
            </span>
            <span className="block text-[15px] leading-[19px] font-extrabold text-tinta">{book.title}</span>
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`shrink-0 text-tinta-suave transition-transform ${bookPickerOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Seletor rápido de livros sob demanda */}
        {bookPickerOpen && (
          <div className="grid grid-cols-1 gap-1.5 rounded-2xl border border-linha bg-cartao p-2 shadow-sm sm:grid-cols-2">
            {modules.map((m) => {
              const mDone = m.lessons.filter((l) => done.includes(l.id)).length;
              const mComplete = mDone === m.lessons.length;
              const isSelected = m.id === book.id;
              const isCurrent = m.id === currentBookId;
              const cover = m.lessons[0] ? pageAssets[m.lessons[0].id] : undefined;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectBook(m.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                    isSelected
                      ? 'bg-tinta text-papel'
                      : isCurrent
                        ? 'bg-amarelo-claro/70 text-tinta hover:bg-amarelo-claro'
                        : 'text-tinta hover:bg-papel-2'
                  }`}
                >
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      className="h-10 w-[30px] shrink-0 rounded-md object-cover"
                      draggable={false}
                    />
                  ) : (
                    <Icon src={`modulo/${m.number}`} size={24} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[10px] font-bold uppercase ${
                        isSelected ? 'text-papel/75' : 'text-tinta-suave'
                      }`}
                    >
                      {th.bookOfTotal(m.number, modules.length)}
                    </span>
                    <span className="block truncate text-[13px] font-bold">{m.title}</span>
                  </span>
                  <span
                    className={`shrink-0 text-xs font-bold tabular-nums ${
                      isSelected ? 'text-papel' : mComplete ? 'text-verde-texto' : 'text-tinta-suave'
                    }`}
                  >
                    {mComplete ? '✓' : `${mDone}/${m.lessons.length}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Barra fina de progresso do livro. Container "group" (não "img": ele tem botões dentro); cada botão tem
            área de toque de 44 px e a barra visual de 6 px fica dentro dele. */}
        <div
          className="flex w-full gap-1.5"
          role="group"
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
                className="flex h-11 min-w-0 grow cursor-pointer items-center"
              >
                <span
                  aria-hidden="true"
                  className={`block h-1.5 w-full rounded-full transition-colors ${
                    isDone ? 'bg-tinta' : isCurr ? 'bg-laranja' : 'bg-papel-2'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Carrossel horizontal das páginas do livro */}
      <div className="relative -mx-4 sm:mx-0">
        <div
          ref={trackRef}
          onScroll={handleTrackScroll}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-1 [&::-webkit-scrollbar]:hidden"
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
                  customImg ? 'w-[90%] max-w-[420px] sm:w-[82%]' : 'w-[90%] sm:w-[80%]'
                } ${
                  isLocked
                    ? 'border-linha/70 opacity-60 grayscale'
                    : isCurrentPage
                      ? 'border-tinta/35 shadow-sm'
                      : 'border-linha'
                }`}
              >
                {/* Ilustração da página do livro em destaque */}
                <div
                  className={`relative flex flex-col items-center justify-center overflow-hidden ${
                    customImg ? 'aspect-[3/4] w-full' : 'min-h-[260px] px-5 pt-5 pb-4 sm:min-h-[300px]'
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
                            alt={pIdx === 0 ? lesson.title : ''}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Selo único e discreto no topo esquerdo */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-cartao/90 px-3 py-1 text-[11px] font-bold tracking-[0.04em] text-tinta uppercase shadow-xs backdrop-blur-xs">
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
                    ) : isDone ? (
                      <span className="text-verde-texto" aria-hidden="true">
                        ✓
                      </span>
                    ) : (
                      <Icon src={`modulo/${book.number}`} size={13} />
                    )}
                    <span>{th.pageOfTotal(lesson.number, book.lessons.length)}</span>
                  </div>
                </div>

                {/* Título curto, gancho e botão */}
                <div className="flex flex-1 flex-col justify-between gap-3 p-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-display text-[19px] leading-[24px] font-extrabold text-tinta sm:text-[21px] sm:leading-[26px]">
                      {lesson.title}
                    </h3>
                    <p className="text-[13px] leading-[19px] text-tinta-suave">
                      {isLocked ? th.unlockHint(lesson.number - 1) : lesson.hook}
                    </p>
                  </div>

                  {isLocked ? (
                    <button
                      type="button"
                      onClick={() => scrollToSlide(currentUnlockedIdx)}
                      className="flex h-11 items-center justify-center rounded-full border border-linha bg-papel-2 px-5 text-sm font-semibold text-tinta transition hover:bg-papel"
                    >
                      {th.goToCurrentPage}
                    </button>
                  ) : (
                    <Link
                      href={`/aprender/${lesson.id}`}
                      className={`flex h-11 items-center justify-center rounded-full px-6 text-[15px] font-semibold no-underline transition-opacity hover:opacity-90 ${
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

        {/* Paginação centralizada sem texto de dica */}
        <div className="mt-2 flex items-center justify-center gap-2.5 px-4">
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
  );
}

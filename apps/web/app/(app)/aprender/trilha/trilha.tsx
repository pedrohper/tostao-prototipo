'use client';
import { Icon } from '@/components/icone';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getDictionary, type Locale } from '@/lib/i18n';
import type { Module } from '@/lib/lessons';
import { takeLegacyDone } from '@/lib/progress';
import { BOOK_THEMES, getStoryPageMeta } from '@/lib/story-cast';
import { importLocalProgress } from '../actions';

/** Biblioteca do Tostão: os 9 módulos em formato de livros na estante, com índice de 5 páginas cada. */
export function Trilha({
  modules,
  colors,
  done: saved,
  coverAssets = {},
  firstPageAssets = {},
  locale = 'pt-BR',
}: {
  modules: Module[];
  colors: string[];
  done: string[];
  coverAssets?: Record<number, string>;
  firstPageAssets?: Record<string, string>;
  locale?: Locale;
}) {
  const t = getDictionary(locale).pages.learnExtra;
  const th = t.hub;
  const [legacyDone, setLegacyDone] = useState<string[]>([]);
  const [openBookId, setOpenBookId] = useState<string | null>(null);
  const done = useMemo(() => [...new Set([...saved, ...legacyDone])], [saved, legacyDone]);

  useEffect(() => {
    const legacy = takeLegacyDone().filter((id) => !saved.includes(id));
    if (!legacy.length) return;
    const timer = setTimeout(() => setLegacyDone(legacy), 0);
    void importLocalProgress(legacy);
    return () => clearTimeout(timer);
  }, [saved]);

  const total = modules.reduce((s, m) => s + m.lessons.length, 0);
  const atualIdx = modules.findIndex((m) => m.lessons.some((l) => !done.includes(l.id)));
  const selectedBook = modules.find((m) => m.id === openBookId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tinta-suave">{t.modulesSummary(modules.length, done.length, total)}</p>
      <div className="flex flex-wrap gap-2">
        <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-papel-2 px-3 text-xs font-semibold">
          <i className="h-2.5 w-2.5 rounded-full bg-laranja" />
          {t.legendInProgress}
        </span>
        <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-papel-2 px-3 text-xs font-semibold">
          <i className="h-2.5 w-2.5 rounded-full border-[1.5px] border-dashed border-tinta-suave" />
          {t.legendOptional}
        </span>
      </div>

      {/* Estante de livros */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3">
        {modules.map((m, i) => {
          const atual = i === atualIdx;
          const feitas = m.lessons.filter((l) => done.includes(l.id)).length;
          const completo = feitas === m.lessons.length;
          const lockedBook = !atual && !completo && feitas === 0;
          const isOpen = openBookId === m.id;
          const theme = BOOK_THEMES[m.number] ?? BOOK_THEMES[1]!;
          const coverImg = coverAssets[m.number] ?? (m.lessons[0] ? firstPageAssets[m.lessons[0].id] : undefined);

          const statusBadge = completo
            ? th.bookReadBadge
            : atual
              ? th.bookReadingBadge
              : m.optional
                ? t.optionalLabel
                : th.bookLockedBadge;

          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setOpenBookId((prev) => (prev === m.id ? null : m.id))}
              aria-expanded={isOpen}
              style={{ borderLeftColor: theme.spineColor }}
              className={`group relative flex flex-col justify-between gap-3 rounded-r-[20px] rounded-l-[8px] border border-l-[10px] p-4 text-left transition-all ${
                isOpen
                  ? 'border-tinta bg-cartao ring-2 ring-tinta/20'
                  : atual
                    ? 'border-laranja bg-cartao shadow-sm hover:-translate-y-0.5'
                    : lockedBook
                      ? 'border-linha bg-cartao/80 opacity-60 grayscale hover:opacity-85'
                      : 'border-linha bg-cartao hover:-translate-y-0.5'
              } ${m.optional && !atual && !isOpen ? 'border-dashed' : ''}`}
            >
              {/* Topo do livro: capa miniatura + status */}
              <div className="flex items-start justify-between gap-2">
                <div
                  className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-linha/60"
                  style={{ background: colors[i] }}
                >
                  {coverImg ? (
                    <img src={coverImg} alt={t.moduleAlt(m.number)} className="h-full w-full object-cover" />
                  ) : (
                    <Icon src={`modulo/${m.number}`} size={34} alt={t.moduleAlt(m.number)} />
                  )}
                  {completo && (
                    <span className="absolute -right-1 -bottom-1">
                      <Icon src="jogo/dia-cumprido" size={20} alt={t.completedAlt} />
                    </span>
                  )}
                  {lockedBook && (
                    <span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border border-linha bg-cartao text-tinta-suave">
                      <svg
                        width="11"
                        height="11"
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
                    </span>
                  )}
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    completo
                      ? 'bg-menta-clara text-verde-texto'
                      : atual
                        ? 'bg-amarelo-claro text-tinta'
                        : 'bg-papel-2 text-tinta-suave'
                  }`}
                >
                  {statusBadge}
                </span>
              </div>

              {/* Título do livro */}
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] font-bold tracking-[0.06em] text-tinta-suave uppercase">
                  {t.moduleAlt(m.number)}
                  {m.optional ? th.optionalSuffix : ''}
                </span>
                <span className="font-display text-[18px] leading-[22px] font-extrabold text-tinta">{m.title}</span>
                <span className="text-[13px] leading-[18px] text-tinta-suave">{t.moduleShort[m.number] ?? ''}</span>
              </div>

              {/* Progresso em 5 capítulos */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-tinta-suave">
                  <span>{feitas ? t.lessonsPartial(feitas, m.lessons.length) : t.lessonsCount(m.lessons.length)}</span>
                  <span aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                </div>
                <div className="flex gap-1">
                  {m.lessons.map((l) => (
                    <i
                      key={l.id}
                      className={`h-1.5 grow rounded-full ${done.includes(l.id) ? 'bg-tinta' : 'bg-papel-2'}`}
                    />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Painel aberto com as 5 páginas do livro selecionado */}
      {selectedBook && (
        <section className="flex flex-col gap-3 rounded-[24px] border border-tinta/30 bg-cartao p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-bold tracking-[0.06em] text-tinta-suave uppercase">
                {th.bookOfTotal(selectedBook.number, modules.length)}
              </span>
              <h2 className="font-display text-[20px] leading-[25px] font-extrabold text-tinta">
                {selectedBook.title}
              </h2>
              <p className="text-[13px] text-tinta-suave">{selectedBook.goal}</p>
            </div>
            <Link
              href={`/aprender?livro=${selectedBook.id}`}
              className="flex h-10 shrink-0 items-center justify-center rounded-full bg-tinta px-4 text-xs font-semibold text-papel no-underline transition-opacity hover:opacity-90"
            >
              {th.openBookInCarousel} ›
            </Link>
          </div>

          <ol className="flex flex-col divide-y divide-linha rounded-2xl border border-linha bg-papel/40 px-3">
            {selectedBook.lessons.map((l, idx) => {
              const isDone = done.includes(l.id);
              const firstUndone = selectedBook.lessons.findIndex((item) => !done.includes(item.id));
              const isLocked = firstUndone >= 0 && idx > firstUndone;
              const meta = getStoryPageMeta(l.id);
              return (
                <li key={l.id}>
                  <Link
                    href={`/aprender/${l.id}`}
                    className={`flex min-h-14 items-center gap-3 py-2.5 text-tinta no-underline transition-opacity hover:opacity-80 ${
                      isLocked ? 'opacity-65 grayscale' : ''
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isDone
                          ? 'bg-menta text-tinta-fixa'
                          : !isLocked
                            ? 'bg-laranja text-tinta-fixa'
                            : 'bg-papel-2 text-tinta-suave'
                      }`}
                    >
                      {isDone ? '✓' : l.number}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-semibold">{l.title}</span>
                      <span className="text-xs text-tinta-suave">{th.speakers[meta.speaker]}</span>
                    </div>
                    <span aria-hidden="true" className="text-sm text-tinta-suave">
                      ›
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

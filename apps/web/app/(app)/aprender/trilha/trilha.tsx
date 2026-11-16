'use client';
import { Icon } from '@/components/icone';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Dictionary } from '@/lib/i18n';
import type { Module } from '@/lib/lessons';
import { takeLegacyDone } from '@/lib/progress';
import { importLocalProgress } from '../actions';

/** Caminho em zigue-zague com os 9 módulos (tela "Todos os módulos" do design). Toque abre as lições. */
export function Trilha({
  modules,
  colors,
  done: saved,
  t,
}: {
  modules: Module[];
  colors: string[];
  done: string[];
  t: Dictionary['pages']['learnExtra'];
}) {
  const [legacyDone, setLegacyDone] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
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

  return (
    <div className="flex flex-col gap-2.5">
      <p className="-mt-2 text-sm text-tinta-suave">{t.modulesSummary(modules.length, done.length, total)}</p>
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
      <div className="flex flex-col gap-[22px] pt-[18px] md:mx-auto md:w-full md:max-w-[560px]">
        {modules.map((m, i) => {
          const left = i % 2 === 0;
          const atual = i === atualIdx;
          const feitas = m.lessons.filter((l) => done.includes(l.id)).length;
          const completo = feitas === m.lessons.length;
          const size = atual ? 86 : 76;
          const pad = left ? (i % 4 === 0 ? 4 : 18) : i % 4 === 1 ? 4 : 18;
          const meta = atual
            ? t.inProgressCount(feitas, m.lessons.length)
            : completo
              ? t.completedLabel
              : m.optional
                ? t.optionalLabel
                : feitas
                  ? t.lessonsPartial(feitas, m.lessons.length)
                  : t.lessonsCount(m.lessons.length);
          const isOpen = open === m.id;
          return (
            <div key={m.id} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : m.id)}
                aria-expanded={isOpen}
                className={`flex items-center gap-3.5 rounded-2xl py-1 text-tinta transition-colors hover:bg-papel-2/50 ${left ? 'text-left' : 'flex-row-reverse text-right'}`}
                style={left ? { paddingLeft: pad } : { paddingRight: pad }}
              >
                <span
                  className={`relative flex shrink-0 items-center justify-center rounded-full font-display font-extrabold ${atual ? 'text-[34px] text-tinta-fixa' : 'text-[28px] text-tinta-suave'} ${m.optional && !atual ? 'border-2 border-dashed border-tinta-suave' : ''}`}
                  style={{
                    width: size,
                    height: size,
                    background: colors[i],
                    boxShadow: atual
                      ? '0 6px 0 var(--color-laranja-texto), 0 0 0 6px var(--color-rosa)'
                      : '0 5px 0 var(--color-linha)',
                  }}
                >
                  <Icon src={`modulo/${m.number}`} size={Math.round(size * 0.94)} alt={t.moduleAlt(m.number)} />
                  {completo && (
                    <span className={`absolute -bottom-1 ${left ? '-right-1' : '-left-1'}`}>
                      <Icon src="jogo/dia-cumprido" size={28} alt={t.completedAlt} />
                    </span>
                  )}
                  {!atual && !completo && feitas === 0 && (
                    <span
                      className={`absolute -bottom-1 ${left ? '-right-1' : '-left-1'} flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-linha bg-cartao text-tinta-suave`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="4" y="11" width="16" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className={`flex min-w-0 flex-col gap-[3px] ${left ? '' : 'items-end'}`}>
                  <span className={`text-xs font-bold ${atual ? 'text-laranja-texto' : 'text-tinta-suave'}`}>
                    {meta}
                  </span>
                  <span className="font-display text-[19px] leading-[23px] font-extrabold">{m.title}</span>
                  <span className="text-[13px] leading-[18px] text-tinta-suave">{t.moduleShort[m.number] ?? ''}</span>
                </span>
              </button>
              {isOpen && (
                <ol className="mt-2 flex flex-col rounded-2xl border border-linha bg-cartao px-3">
                  {m.lessons.map((l) => (
                    <li key={l.id} className="border-b border-linha last:border-b-0">
                      <Link
                        href={`/aprender/${l.id}`}
                        className="flex min-h-12 items-center gap-3 text-tinta no-underline"
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done.includes(l.id) ? 'bg-menta text-tinta-fixa' : 'bg-papel-2'}`}
                        >
                          {done.includes(l.id) ? '✓' : l.number}
                        </span>
                        <span className="text-[15px]">{l.title}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';
import { Icone } from '@/components/icone';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Module } from '@/lib/lessons';
import { takeLegacyDone } from '@/lib/progress';
import { importLocalProgress } from '../actions';

const SHORT: Record<number, string> = {
  1: 'Pra onde vai seu dinheiro', 2: 'Fatura, rotativo e parcelado', 3: 'Qual pagar primeiro e como negociar',
  4: 'Reserva de emergência', 5: 'Cursos, freela e renda extra', 6: 'Holerite, FGTS, 13º e férias',
  7: 'Tesouro, CDB e FGC', 8: 'Ações, FIIs e ETFs sem guru', 9: 'Golpes, bets e pirâmides',
};

/** Caminho em zigue-zague com os 9 módulos (tela "Todos os módulos" do design). Toque abre as lições. */
export function Trilha({ modules, colors, done: saved }: { modules: Module[]; colors: string[]; done: string[] }) {
  const [done, setDone] = useState<string[]>(saved);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setDone(saved), [saved]);
  useEffect(() => {
    const legacy = takeLegacyDone().filter((id) => !saved.includes(id));
    if (legacy.length) {
      setDone((d) => [...new Set([...d, ...legacy])]);
      void importLocalProgress(legacy);
    }
  }, [saved]);
  const total = modules.reduce((s, m) => s + m.lessons.length, 0);
  const atualIdx = modules.findIndex((m) => m.lessons.some((l) => !done.includes(l.id)));

  return (
    <div className="flex flex-col gap-2.5">
      <p className="-mt-2 text-sm text-tinta-suave">{modules.length} módulos · {done.length} de {total} lições feitas</p>
      <div className="flex flex-wrap gap-2">
        <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-papel-2 px-3 text-xs font-semibold"><i className="h-2.5 w-2.5 rounded-full bg-laranja" />Em andamento</span>
        <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-papel-2 px-3 text-xs font-semibold"><i className="h-2.5 w-2.5 rounded-full border-[1.5px] border-dashed border-tinta-suave" />Só se fizer sentido pra você</span>
      </div>
      <div className="flex flex-col gap-[22px] pt-[18px]">
        {modules.map((m, i) => {
          const left = i % 2 === 0;
          const atual = i === atualIdx;
          const feitas = m.lessons.filter((l) => done.includes(l.id)).length;
          const completo = feitas === m.lessons.length;
          const size = atual ? 86 : 76;
          const pad = left ? (i % 4 === 0 ? 4 : 18) : (i % 4 === 1 ? 4 : 18);
          const meta = atual ? `Em andamento · ${feitas} de ${m.lessons.length}` : completo ? 'Concluído' : m.optional ? 'Só pra quem tem dívida' : feitas ? `${feitas} de ${m.lessons.length} lições` : `${m.lessons.length} lições`;
          const isOpen = open === m.id;
          return (
            <div key={m.id} className="flex flex-col gap-2">
              <button type="button" onClick={() => setOpen(isOpen ? null : m.id)} aria-expanded={isOpen}
                className={`flex items-center gap-3.5 text-tinta ${left ? 'text-left' : 'flex-row-reverse text-right'}`}
                style={left ? { paddingLeft: pad } : { paddingRight: pad }}>
                <span className={`relative flex shrink-0 items-center justify-center rounded-full font-display font-extrabold ${atual ? 'text-[34px] text-[#1E1B18]' : 'text-[28px] text-[#6B635A]'} ${m.optional && !atual ? 'border-2 border-dashed border-[#6B635A]' : ''}`}
                  style={{ width: size, height: size, background: colors[i], boxShadow: atual ? '0 6px 0 #C2410C, 0 0 0 6px var(--color-rosa)' : '0 5px 0 var(--color-linha)' }}>
                  <Icone src={`modulo/${m.number}`} size={Math.round(size * 0.94)} alt={`Módulo ${m.number}`} />
                  {completo && <span className={`absolute -bottom-1 ${left ? '-right-1' : '-left-1'}`}><Icone src="jogo/dia-cumprido" size={28} alt="completo" /></span>}
                  {!atual && !completo && feitas === 0 && (
                    <span className={`absolute -bottom-1 ${left ? '-right-1' : '-left-1'} flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-linha bg-cartao`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B635A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                    </span>
                  )}
                </span>
                <span className={`flex min-w-0 flex-col gap-[3px] ${left ? '' : 'items-end'}`}>
                  <span className={`text-xs font-bold ${atual ? 'text-laranja-texto' : 'text-tinta-suave'}`}>{meta}</span>
                  <span className="font-display text-[19px] leading-[23px] font-extrabold">{m.title}</span>
                  <span className="text-[13px] leading-[18px] text-tinta-suave">{SHORT[m.number] ?? ''}</span>
                </span>
              </button>
              {isOpen && (
                <ol className="mt-2 flex flex-col rounded-2xl border border-linha bg-cartao px-3">
                  {m.lessons.map((l) => (
                    <li key={l.id} className="border-b border-linha last:border-b-0">
                      <Link href={`/aprender/${l.id}`} className="flex min-h-12 items-center gap-3 text-tinta no-underline">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done.includes(l.id) ? 'bg-menta text-[#1E1B18]' : 'bg-papel-2'}`}>{done.includes(l.id) ? '✓' : l.number}</span>
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

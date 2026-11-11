'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Module } from '@/lib/lessons';
import { getDone } from '@/lib/progress';

export function Trilha({ modules, colors }: { modules: Module[]; colors: string[] }) {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => setDone(getDone()), []);
  const total = modules.reduce((s, m) => s + m.lessons.length, 0);
  const next = modules.flatMap((m) => m.lessons).find((l) => !done.includes(l.id));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tinta-suave">{modules.length} módulos · {done.length} de {total} lições feitas</p>
      {next && (
        <Link href={`/aprender/${next.id}`} className="flex flex-col gap-1 rounded-[20px] bg-tinta p-4 text-papel no-underline">
          <span className="text-xs font-bold tracking-wider text-amarelo uppercase">{done.length ? 'Continuar' : 'Começar'}</span>
          <span className="font-display text-xl font-extrabold">{next.title}</span>
          <span className="text-sm opacity-80">2 minutos · 6 passos</span>
        </Link>
      )}
      {modules.map((m, i) => {
        const feitas = m.lessons.filter((l) => done.includes(l.id)).length;
        return (
          <details key={m.id} open={i === 0} className={`rounded-[20px] bg-cartao p-4 ${m.optional ? 'border-2 border-dashed border-tinta-suave/50' : ''}`}>
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-display text-2xl font-extrabold text-[#1E1B18]" style={{ background: colors[i] }}>{m.number}</span>
              <span className="flex min-w-0 flex-col">
                <span className={`text-xs font-bold ${feitas ? 'text-laranja-texto' : 'text-tinta-suave'}`}>
                  {m.optional ? 'Só pra quem tem dívida · ' : ''}{feitas}/{m.lessons.length} lições
                </span>
                <span className="font-display text-lg leading-tight font-extrabold">{m.title}</span>
              </span>
            </summary>
            <p className="mt-3 text-sm text-tinta-suave">{m.goal}</p>
            <ol className="mt-3 flex flex-col gap-1">
              {m.lessons.map((l) => (
                <li key={l.id}>
                  <Link href={`/aprender/${l.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 no-underline hover:bg-papel-2">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done.includes(l.id) ? 'bg-menta text-[#1E1B18]' : 'bg-papel-2'}`}>{done.includes(l.id) ? '✓' : l.number}</span>
                    <span className="text-[15px]">{l.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}

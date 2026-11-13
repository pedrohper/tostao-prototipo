'use client';
import { useState, useTransition } from 'react';
import { salvarInicio } from '@/lib/inicio-actions';

type Linha = { id: string; nome: string; dica: string };
const seta = (d: string, off: boolean) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={off ? 'text-linha' : ''}><path d={d} /></svg>;

export function PersonalizarForm({ linhas, ocultos, padrao }: { linhas: Linha[]; ocultos: string[]; padrao: string[] }) {
  const [ordem, setOrdem] = useState(linhas.map((l) => l.id));
  const [off, setOff] = useState(new Set(ocultos));
  const [pending, start] = useTransition();
  const byId = new Map(linhas.map((l) => [l.id, l]));
  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= ordem.length) return;
    const o = [...ordem];
    [o[i], o[j]] = [o[j]!, o[i]!];
    setOrdem(o);
  };
  return (
    <>
      <ul className="flex flex-col rounded-2xl border border-linha bg-cartao pr-1.5 pl-3.5">
        {ordem.map((id, i) => {
          const l = byId.get(id)!;
          const on = !off.has(id);
          return (
            <li key={id} className="flex items-center gap-0.5 border-b border-linha last:border-b-0">
              <label className="flex min-h-14 min-w-0 grow cursor-pointer items-center gap-3">
                <input type="checkbox" checked={on} onChange={() => { const n = new Set(off); if (on) n.add(id); else n.delete(id); setOff(n); }} className="h-[22px] w-[22px] shrink-0 accent-tinta" />
                <span className="flex min-w-0 flex-col">
                  <span className={`text-[15px] font-semibold ${on ? '' : 'text-tinta-suave'}`}>{l.nome}</span>
                  <span className="text-xs text-tinta-suave">{l.dica}</span>
                </span>
              </label>
              <button type="button" aria-label={`Subir ${l.nome}`} disabled={i === 0} onClick={() => mover(i, -1)} className="flex h-11 w-10 shrink-0 items-center justify-center">{seta('M18 15l-6-6-6 6', i === 0)}</button>
              <button type="button" aria-label={`Descer ${l.nome}`} disabled={i === ordem.length - 1} onClick={() => mover(i, 1)} className="flex h-11 w-10 shrink-0 items-center justify-center">{seta('M6 9l6 6 6-6', i === ordem.length - 1)}</button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-0.5 rounded-2xl bg-amarelo-claro px-3.5 py-3">
        <span className="text-sm font-bold">Avisos que você fechou no X</span>
        <span className="text-[13px] leading-[19px]">Somem até ter novidade. Se surgir gasto novo sem categoria, outra conta pra vencer ou um limite estourado, o aviso volta.</span>
      </div>
      <button type="button" onClick={() => { setOrdem(padrao); setOff(new Set()); }} className="min-h-11 self-center text-sm font-semibold text-laranja-texto">Voltar ao padrão</button>
      <button type="button" disabled={pending} onClick={() => start(() => salvarInicio(ordem, [...off]))}
        className="sticky bottom-[104px] flex h-[52px] items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel disabled:opacity-60 md:bottom-6">
        {pending ? 'Salvando…' : 'Salvar'}
      </button>
    </>
  );
}

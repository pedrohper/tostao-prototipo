'use client';
import { useState } from 'react';
import { TAXAS_REFERENCIA } from '@tostao/contracts';
import { money } from '@/lib/format';
import { CompensaParcelar } from '@/components/juros';

// Simuladores interativos.
// Cada um novo entra aqui com o id da lição.
export const SIMULATORS: Record<string, () => React.ReactNode> = {
  'm1-l1': RaloDoCafezinho,
  'm2-l3': () => <CompensaParcelar taxas={TAXAS_REFERENCIA} compacto />,
};

function RaloDoCafezinho() {
  const [valor, setValor] = useState(20);
  const [vezes, setVezes] = useState(4);
  const porSemana = valor * vezes * 100;
  const tres = Math.round(porSemana * 13);
  const ano = Math.round(porSemana * 52);
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold"><span>Cada gastinho</span><span>{money(valor * 100)}</span></span>
        <input type="range" min={10} max={30} value={valor} onChange={(e) => setValor(+e.target.value)} className="accent-[#FF5A36]" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold"><span>Vezes por semana</span><span>{vezes}x</span></span>
        <input type="range" min={1} max={7} value={vezes} onChange={(e) => setVezes(+e.target.value)} className="accent-[#FF5A36]" />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-amarelo-claro p-3"><span className="text-xs font-semibold">Em 3 meses</span><p className="font-display text-2xl font-extrabold">{money(tres)}</p></div>
        <div className="rounded-2xl bg-rosa p-3"><span className="text-xs font-semibold">Em 1 ano</span><p className="font-display text-2xl font-extrabold">{money(ano)}</p></div>
      </div>
      <p className="text-sm text-tinta-suave">Isso dá {(ano / 130790).toFixed(1).replace('.', ',')} salários de R$ 1.307,90 por ano.</p>
    </div>
  );
}

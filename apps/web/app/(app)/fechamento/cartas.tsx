'use client';
import { useState } from 'react';
import Link from 'next/link';

/** Fechamento em cartas (igual ao artefato): barrinhas no topo, uma carta por vez, "Próxima carta" embaixo. */
export function Cartas({ cartas, share, header }: { cartas: React.ReactNode[]; share: React.ReactNode; header: React.ReactNode }) {
  const [i, setI] = useState(0);
  const last = i >= cartas.length - 1;
  return (
    <>
      <div className="flex gap-1.5" role="img" aria-label={`Carta ${i + 1} de ${cartas.length}`}>
        {cartas.map((_, k) => (
          <button key={k} type="button" onClick={() => setI(k)} aria-label={`Ir pra carta ${k + 1}`} className="h-1 grow rounded-full py-0">
            <span className={`block h-1 rounded-full ${k <= i ? 'bg-[#1E1B18]' : 'bg-[#1E1B18]/25'}`} />
          </button>
        ))}
      </div>
      {header}
      <div key={i} className="tela flex flex-col gap-3.5">{cartas[i]}</div>
      <div className="grow" />
      <div className="grid grid-cols-2 gap-2.5">
        {i > 0 && !last ? (
          <button type="button" onClick={() => setI(i - 1)} className="h-[52px] rounded-full border-2 border-[#1E1B18] text-[15px] font-bold text-[#1E1B18]">Voltar</button>
        ) : share}
        {last ? (
          <Link href="/inicio" className="flex h-[52px] items-center justify-center rounded-full bg-[#1E1B18] text-[15px] font-bold text-[#FDFBF6] no-underline">Voltar pro início</Link>
        ) : (
          <button type="button" onClick={() => setI(i + 1)} className="h-[52px] rounded-full bg-[#1E1B18] text-[15px] font-bold text-[#FDFBF6]">Próxima carta</button>
        )}
      </div>
    </>
  );
}

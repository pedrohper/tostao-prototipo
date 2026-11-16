'use client';
import { useState } from 'react';
import Link from 'next/link';
import { getDictionary, type Dictionary } from '@/lib/i18n';

/** Fechamento em cartas (igual ao artefato): barrinhas no topo, uma carta por vez, "Próxima carta" embaixo. */
export function Cartas({
  cartas,
  share,
  header,
  t,
  backLabel,
}: {
  cartas: React.ReactNode[];
  share: React.ReactNode;
  header: React.ReactNode;
  t?: Dictionary['pages']['fechamento'];
  backLabel?: string;
}) {
  const dict = getDictionary('pt-BR');
  const labels = t ?? dict.pages.fechamento;
  const backTxt = backLabel ?? dict.common.back;
  const [i, setI] = useState(0);
  const last = i >= cartas.length - 1;
  return (
    <>
      <div className="flex gap-1.5" role="img" aria-label={labels.cardAria(i + 1, cartas.length)}>
        {cartas.map((_, k) => (
          <button
            key={k}
            type="button"
            onClick={() => setI(k)}
            aria-label={labels.goToCardAria(k + 1)}
            className="h-1 grow rounded-full py-0"
          >
            <span className={`block h-1 rounded-full ${k <= i ? 'bg-tinta-fixa' : 'bg-tinta-fixa/25'}`} />
          </button>
        ))}
      </div>
      {header}
      <div key={i} className="tela flex flex-col gap-3.5">
        {cartas[i]}
      </div>
      <div className="grow" />
      <div className="grid grid-cols-2 gap-2.5">
        {i > 0 && !last ? (
          <button
            type="button"
            onClick={() => setI(i - 1)}
            className="h-[52px] rounded-full border-2 border-tinta-fixa text-[15px] font-bold text-tinta-fixa"
          >
            {backTxt}
          </button>
        ) : (
          share
        )}
        {last ? (
          <Link
            href="/inicio"
            className="flex h-[52px] items-center justify-center rounded-full bg-tinta-fixa text-[15px] font-bold text-papel-fixo no-underline"
          >
            {labels.backToStart}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setI(i + 1)}
            className="h-[52px] rounded-full bg-tinta-fixa text-[15px] font-bold text-papel-fixo"
          >
            {labels.nextCard}
          </button>
        )}
      </div>
    </>
  );
}

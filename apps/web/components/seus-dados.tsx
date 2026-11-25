'use client';
// /mais → "Seus dados" (T6.21): a planilha (CSV), com o período, ao lado do arquivo completo da LGPD (JSON).
import { useState, type KeyboardEvent } from 'react';
import { PERIODOS_CSV, urlDoCsv, type PeriodoCsv } from '@/lib/periodo-csv';
import { ExportDataButton } from './export-data-button';
import { Eyebrow } from './ui';

const ROW =
  'flex min-h-[68px] w-full cursor-pointer items-center justify-between gap-3 py-3 text-left text-tinta hover:opacity-80 disabled:opacity-60';

function Rotulo({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-xs leading-[17px] text-tinta-suave">{subtitle}</span>
      </span>
      <span className="shrink-0 text-lg text-tinta-suave" aria-hidden="true">
        ↓
      </span>
    </>
  );
}

function Periodos({ valor, onChange }: { valor: PeriodoCsv; onChange: (periodo: PeriodoCsv) => void }) {
  const andar = (event: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const passo = ['ArrowDown', 'ArrowRight'].includes(event.key)
      ? 1
      : ['ArrowUp', 'ArrowLeft'].includes(event.key)
        ? -1
        : 0;
    if (passo === 0) return;
    event.preventDefault();
    const proximo = (indice + passo + PERIODOS_CSV.length) % PERIODOS_CSV.length;
    onChange(PERIODOS_CSV[proximo]!.id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[proximo]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Período da planilha" className="flex flex-wrap gap-2 pb-3">
      {PERIODOS_CSV.map((periodo, indice) => {
        const marcado = periodo.id === valor;
        return (
          <button
            key={periodo.id}
            type="button"
            role="radio"
            aria-checked={marcado}
            tabIndex={marcado ? 0 : -1}
            onKeyDown={(event) => andar(event, indice)}
            onClick={() => onChange(periodo.id)}
            className={`min-h-11 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold ${
              marcado ? 'border-tinta bg-tinta text-papel' : 'border-linha bg-cartao text-tinta'
            }`}
          >
            {periodo.rotulo}
          </button>
        );
      })}
    </div>
  );
}

export function SeusDados() {
  const [periodo, setPeriodo] = useState<PeriodoCsv>('tudo');
  return (
    <section aria-label="Seus dados" className="flex flex-col gap-2">
      <Eyebrow>Seus dados</Eyebrow>
      <div className="flex flex-col divide-y divide-linha rounded-[22px] border border-linha bg-cartao px-4 py-1">
        <div className="flex flex-col">
          <ExportDataButton
            href={urlDoCsv(periodo)}
            fallbackName="tostao-lancamentos.csv"
            label={<Rotulo title="Baixar planilha (CSV)" subtitle="Seus lançamentos, pra abrir no Excel" />}
            busyLabel="Montando a planilha…"
            successMessage="Planilha baixada."
            errorMessage="Não consegui montar a planilha agora."
            className={ROW}
          />
          <Periodos valor={periodo} onChange={setPeriodo} />
        </div>
        <ExportDataButton
          label={<Rotulo title="Baixar tudo (JSON)" subtitle="Tudo que o Tostão guarda de você (LGPD)" />}
          busyLabel="Juntando seus dados…"
          successMessage="Arquivo baixado."
          errorMessage="Não consegui juntar os dados agora."
          className={ROW}
        />
      </div>
      <p className="text-xs leading-[18px] text-tinta-suave">
        Dá pra baixar 2 vezes por dia, somando os dois. O arquivo é seu: guarda num lugar seguro.
      </p>
    </section>
  );
}

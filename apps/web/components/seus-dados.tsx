// /mais → "Seus dados" (T6.21): a planilha (CSV) ao lado do arquivo completo da LGPD (JSON).
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

export function SeusDados() {
  return (
    <section aria-label="Seus dados" className="flex flex-col gap-2">
      <Eyebrow>Seus dados</Eyebrow>
      <div className="flex flex-col divide-y divide-linha rounded-[22px] border border-linha bg-cartao px-4 py-1">
        <ExportDataButton
          href="/api/me/export.csv"
          fallbackName="tostao-lancamentos.csv"
          label={<Rotulo title="Baixar planilha (CSV)" subtitle="Seus lançamentos, pra abrir no Excel" />}
          busyLabel="Montando a planilha…"
          successMessage="Planilha baixada."
          errorMessage="Não consegui montar a planilha agora."
          className={ROW}
        />
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

'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Button, ErrorNote, Field } from '@/components/ui';
import { getDictionary, type Locale } from '@/lib/i18n';
import { importStatement, type ImportState } from './actions';

const fmt = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleDateString(locale, { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

export function ImportForm({ conta, contas, locale = 'pt-BR' }: { conta?: string; contas: string[]; locale?: Locale }) {
  const labels = getDictionary(locale).pages.importar.form;
  const [state, action, pending] = useActionState<ImportState, FormData>(importStatement, {});
  const [nome, setNome] = useState(conta ?? '');
  const [arquivos, setArquivos] = useState<string[]>([]);
  const r = state.result;
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Field
          label={labels.accountLabel}
          name="accountName"
          placeholder={labels.accountPlaceholder}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={40}
        />
        {contas.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label={labels.previousAccountsAria}>
            {contas.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNome(c)}
                className={`h-9 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold ${nome === c ? 'border-tinta bg-tinta text-papel' : 'border-linha bg-cartao'}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-[5px]">
        <span className="text-[13px] font-semibold">{labels.fileLabel}</span>
        <label className="relative flex min-h-16 cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-tinta-suave/70 bg-cartao px-4 py-3 focus-within:border-tinta">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0"
          >
            <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
          </svg>
          <span className="min-w-0 text-[15px] font-semibold">
            {arquivos.length === 0
              ? labels.chooseFile
              : arquivos.length === 1
                ? arquivos[0]
                : labels.filesCount(arquivos.length)}
            {arquivos.length === 0 && (
              <span className="block text-[12px] font-normal text-tinta-suave">{labels.multiFileHint}</span>
            )}
          </span>
          <input
            type="file"
            name="file"
            multiple
            accept=".ofx,.csv,.txt,text/csv,application/x-ofx"
            required
            onChange={(e) => setArquivos([...(e.target.files ?? [])].map((f) => f.name))}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-semibold">{labels.kindLegend}</legend>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-papel-2 p-1">
          {(
            [
              ['auto', labels.kindAuto],
              ['conta', labels.kindAccount],
              ['cartao', labels.kindCard],
            ] as const
          ).map(([v, l]) => (
            <label
              key={v}
              className="cursor-pointer rounded-full text-center text-[14px] font-semibold h-10 flex items-center justify-center has-[:checked]:bg-tinta has-[:checked]:text-papel"
            >
              <input type="radio" name="tipo" value={v} defaultChecked={v === 'auto'} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
        <p className="text-[12px] leading-[17px] text-tinta-suave">{labels.cardTip}</p>
      </fieldset>
      <ErrorNote message={state.error} />
      {r && (
        <div role="status" className="rounded-2xl bg-menta-clara p-3 text-[15px]">
          <b>{labels.resultCount(r.importedCount)}</b>
          {labels.resultLocation(r.accountName, fmt(r.from, locale), fmt(r.to, locale))}
          {r.skipped > 0 && labels.skippedNote(r.skipped)}{' '}
          <Link href="/carteira" className="font-semibold underline">
            {labels.viewInWallet}
          </Link>
        </div>
      )}
      {state.failed && state.failed.length > 0 && (
        <p className="rounded-2xl bg-rosa p-3 text-[14px]">
          {labels.failedPrefix}
          {state.failed.join('; ')}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? labels.pending : labels.submit}
      </Button>
    </form>
  );
}

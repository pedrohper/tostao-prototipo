'use client';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import type { ImportPreviewResponse, ImportResponse } from '@tostao/contracts';
import { Button, ErrorNote } from '@/components/ui';
import { useToast } from '@/components/toast';
import { money } from '@/lib/format';
import { buildRowsBody, keptTotal, toEditable, type EditableRow } from '@/lib/pdf-import';
import { confirmPdfImport, discardShared, previewPdf, previewSharedPdf, type PdfPreviewState } from './actions';

const input =
  'h-10 min-w-0 rounded-lg border-[1.5px] border-linha bg-cartao px-2 text-[14px] text-tinta outline-none focus:border-tinta';

/** Pré-visualização editável: a pessoa confere, ajusta e tira linhas ANTES de gravar. */
function PreviewEditor({
  preview,
  fileName,
  shareId,
  onDone,
  onCancel,
}: {
  preview: ImportPreviewResponse;
  fileName: string;
  shareId?: string;
  onDone: (r: ImportResponse) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<EditableRow[]>(() => toEditable(preview.rows));
  const [isCard, setIsCard] = useState(preview.kind === 'CREDIT');
  const [name, setName] = useState(preview.suggestedAccountName);
  const [error, setError] = useState<string | undefined>();
  const [issues, setIssues] = useState<Set<number>>(new Set());
  const [saving, startSaving] = useTransition();

  const kept = rows.filter((r) => r.keep).length;
  const total = keptTotal(rows, isCard);
  const patch = (i: number, p: Partial<EditableRow>) =>
    setRows((all) => all.map((r, k) => (k === i ? { ...r, ...p } : r)));

  const submit = () => {
    const built = buildRowsBody(rows, { accountName: name.trim() || preview.suggestedAccountName, fileName, isCard });
    if (!built.ok) {
      setIssues(new Set(built.issues.map((x) => x.index)));
      setError(
        built.issues[0]?.index === -1
          ? built.issues[0].message
          : 'Tem linha com problema (em vermelho). Corrige ou tira ela.',
      );
      return;
    }
    setIssues(new Set());
    setError(undefined);
    startSaving(async () => {
      const r = await confirmPdfImport(built.body, shareId);
      if (r.result) {
        toast.success(`${r.result.importedCount} lançamento(s) importado(s).`);
        onDone(r.result);
      } else setError(r.error);
    });
  };

  if (preview.rows.length === 0)
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-papel-2 p-4 text-[14px] leading-5">
        <p className="font-semibold">Não consegui achar lançamentos nesse PDF.</p>
        <p className="text-tinta-suave">
          {preview.aiBlockedReason === 'no_consent'
            ? 'Esse layout eu não conheço. Posso pedir ajuda à IA (o texto vai mascarado), mas você ainda não deu o aceite. Ative em Perfil → Privacidade, ou baixe o extrato em OFX/CSV.'
            : preview.aiBlockedReason === 'quota'
              ? 'Esse layout eu não conheço e você já usou a leitura por IA de hoje. Tente amanhã ou baixe o extrato em OFX/CSV.'
              : preview.aiBlockedReason === 'disabled'
                ? 'Esse layout eu não conheço e a leitura por IA não está disponível. Baixe o extrato em OFX/CSV.'
                : 'Tente baixar o extrato em OFX ou CSV no app do banco.'}
        </p>
        <button type="button" onClick={onCancel} className="self-start text-[14px] font-semibold underline">
          Escolher outro arquivo
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        {preview.bank && (
          <span className="rounded-full bg-tinta px-3 py-1 font-semibold text-papel">{preview.bank}</span>
        )}
        <span className="rounded-full bg-papel-2 px-3 py-1 font-semibold">
          {isCard ? 'Fatura de cartão' : 'Extrato de conta'}
        </span>
        {preview.source === 'ai' && (
          <span className="rounded-full bg-amarelo-claro px-3 py-1 font-semibold">Lido com ajuda da IA</span>
        )}
      </div>
      {preview.warnings.map((w) => (
        <p key={w} role="note" className="rounded-xl bg-amarelo-claro px-3 py-2 text-[13px] leading-[18px]">
          {w}
        </p>
      ))}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1" role="group" aria-label="Tipo do arquivo">
        {([false, true] as const).map((card) => (
          <button
            key={String(card)}
            type="button"
            aria-pressed={isCard === card}
            onClick={() => setIsCard(card)}
            className={`flex h-10 items-center justify-center rounded-full text-[14px] font-semibold ${isCard === card ? 'bg-tinta text-papel' : 'text-tinta'}`}
          >
            {card ? 'Cartão' : 'Conta'}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">Nome da {isCard ? 'conta do cartão' : 'conta'}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className={`${input} h-11 text-base`}
        />
      </label>

      <ul className="flex flex-col gap-2" aria-label="Lançamentos lidos do PDF">
        {rows.map((r, i) => (
          <li
            key={r.key}
            className={`flex flex-col gap-2 rounded-xl border-[1.5px] p-2.5 ${issues.has(i) ? 'border-vermelho-texto bg-rosa/40' : 'border-linha bg-cartao'} ${r.keep ? '' : 'opacity-50'}`}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={r.keep}
                onChange={(e) => patch(i, { keep: e.target.checked })}
                aria-label={`Importar ${r.description}`}
                className="h-5 w-5 shrink-0 accent-[var(--color-tinta)]"
              />
              <input
                type="date"
                value={r.date}
                onChange={(e) => patch(i, { date: e.target.value })}
                aria-label={`Data de ${r.description}`}
                className={`${input} w-[9.5rem] shrink-0`}
              />
              <input
                value={r.description}
                onChange={(e) => patch(i, { description: e.target.value })}
                maxLength={140}
                aria-label="Descrição"
                className={`${input} flex-1`}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pl-7">
              <button
                type="button"
                aria-pressed={r.out}
                onClick={() => patch(i, { out: !r.out })}
                className={`h-10 rounded-lg px-3 text-[13px] font-bold ${r.out ? 'bg-rosa text-vermelho-texto' : 'bg-menta-clara text-verde-texto'}`}
              >
                {r.out ? 'Saiu' : 'Entrou'}
              </button>
              <input
                value={r.amount}
                onChange={(e) => patch(i, { amount: e.target.value })}
                inputMode="decimal"
                aria-label={`Valor de ${r.description}`}
                className={`${input} w-28 text-right tabular-nums`}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-papel-2 px-3.5 py-3 text-[14px]">
        <span>
          {kept} de {rows.length} linhas · {isCard ? 'total de compras' : 'saldo do período'}
        </span>
        <b className="font-display text-lg tabular-nums">{money(Math.abs(total))}</b>
      </div>
      {preview.statedTotalInCents !== null && isCard && (
        <p className="text-[13px] text-tinta-suave">
          O PDF diz que o total da fatura é {money(preview.statedTotalInCents)}.
          {Math.abs(preview.statedTotalInCents - total) > 1
            ? ' Confere se faltou alguma linha.'
            : ' Bateu com as linhas.'}
        </p>
      )}
      <ErrorNote message={error} />
      <Button type="button" disabled={saving || kept === 0} onClick={submit}>
        {saving ? 'Importando…' : `Importar ${kept} lançamento${kept === 1 ? '' : 's'}`}
      </Button>
      <button
        type="button"
        onClick={onCancel}
        className="self-center py-1 text-[13px] font-semibold text-tinta-suave underline"
      >
        Cancelar
      </button>
    </div>
  );
}

/**
 * Importar PDF de fatura/extrato (T5.3). `shareId` = veio do "Compartilhar" do Android: lê sozinho ao abrir.
 * Nada é gravado até a pessoa conferir e tocar em "Importar".
 */
export function PdfImport({ shareId }: { shareId?: string }) {
  const [state, action, pending] = useActionState<PdfPreviewState, FormData>(previewPdf, {});
  const [shared, setShared] = useState<PdfPreviewState | null>(null);
  const [sharedLoading, setSharedLoading] = useState(!!shareId);
  const [done, setDone] = useState<ImportResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [fileLabel, setFileLabel] = useState('');
  const started = useRef(false);

  // Veio do Compartilhar: lê o PDF guardado uma vez (o efeito dispara no máximo uma vez, mesmo em modo estrito).
  useEffect(() => {
    if (!shareId || started.current) return;
    started.current = true;
    previewSharedPdf(shareId)
      .then(setShared)
      .catch(() => setShared({ error: 'Não consegui ler o arquivo compartilhado.' }))
      .finally(() => setSharedLoading(false));
  }, [shareId]);

  const current = shared ?? state;
  const preview = dismissed ? undefined : current.preview;

  if (done)
    return (
      <div role="status" className="flex flex-col gap-2 rounded-2xl bg-menta-clara p-4 text-[15px]">
        <p>
          <b>{done.importedCount} lançamento(s) importado(s)</b> em {done.accountName}.
          {done.skipped > 0 && ` ${done.skipped} já estavam aqui e foram pulados.`}
        </p>
        <Link href="/carteira" className="font-semibold underline">
          Ver na Carteira
        </Link>
      </div>
    );

  if (preview)
    return (
      <PreviewEditor
        preview={preview}
        fileName={current.fileName ?? 'fatura.pdf'}
        shareId={shareId}
        onDone={setDone}
        onCancel={() => {
          setDismissed(true);
          if (shareId) void discardShared(shareId);
        }}
      />
    );

  return (
    <form action={action} onSubmit={() => setDismissed(false)} className="flex flex-col gap-3">
      {shareId && sharedLoading && (
        <p role="status" className="rounded-xl bg-papel-2 px-3 py-2.5 text-[14px]">
          Lendo o PDF que você compartilhou…
        </p>
      )}
      <label className="relative flex min-h-16 cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-tinta-suave/70 bg-cartao px-4 py-3 focus-within:border-tinta">
        <span aria-hidden className="text-xl">
          📄
        </span>
        <span className="min-w-0 text-[15px] font-semibold">
          {fileLabel || 'Escolher o PDF'}
          {!fileLabel && (
            <span className="block text-[12px] font-normal text-tinta-suave">
              Fatura do cartão ou extrato da conta, até 10 MB
            </span>
          )}
        </span>
        <input
          type="file"
          name="pdf"
          accept="application/pdf,.pdf"
          required
          onChange={(e) => setFileLabel(e.target.files?.[0]?.name ?? '')}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <ErrorNote message={current.error} />
      <Button type="submit" disabled={pending || !fileLabel}>
        {pending ? 'Lendo o PDF…' : 'Ler o PDF'}
      </Button>
      <p className="text-[12px] leading-[17px] text-tinta-suave">
        O Tostão lê o PDF aqui no servidor e mostra as linhas pra você conferir antes de gravar. Se o layout for
        desconhecido, e só se você já aceitou o uso de IA, o texto vai pra IA mascarado (sem nome, CPF ou número de
        conta).
      </p>
    </form>
  );
}

'use client';
// Fechamento → "Compartilhar" (T6.19): mostra a prévia da imagem do mês e manda pelo compartilhamento do celular.
// A imagem é baixada ANTES do toque em "Compartilhar": o navegador (iPhone principalmente) só abre o compartilhamento
// direto no toque, sem espera no meio.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogA11y } from '@/lib/use-dialog-a11y';

const FALLBACK_ERROR = 'Não consegui montar a imagem. Tenta de novo.';

type Result = { query: string; url: string; file: File } | { query: string; error: string };

export function CompartilharMes({ month, monthName }: { month: string; monthName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="h-[52px] rounded-full border-2 border-tinta-fixa text-[15px] font-bold text-tinta-fixa"
      >
        Compartilhar
      </button>
      {open &&
        createPortal(
          <CompartilharPainel month={month} monthName={monthName} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  );
}

export function CompartilharPainel({
  month,
  monthName,
  onClose,
}: {
  month: string;
  monthName: string;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [showValues, setShowValues] = useState(false); // valores em reais escondidos por padrão
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  useDialogA11y({ open: true, containerRef: panel, onClose });

  const query = `mes=${month}${showValues ? '&valores=1' : ''}`;
  const current = result?.query === `${query}#${attempt}` ? result : null;
  const ready = current && 'url' in current ? current : null;
  const error = current && 'error' in current ? current.error : null;

  useEffect(() => {
    const controller = new AbortController();
    const id = `${query}#${attempt}`;
    let url: string | null = null;
    (async () => {
      const res = await fetch(`/api/fechamento/imagem?${query}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setResult({ query: id, error: body?.message ?? FALLBACK_ERROR });
        return;
      }
      const blob = await res.blob();
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setResult({ query: id, url, file: new File([blob], `tostao-${month}.png`, { type: 'image/png' }) });
    })().catch(() => {
      if (!controller.signal.aborted) setResult({ query: id, error: FALLBACK_ERROR });
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [query, attempt, month]);

  const canShare = Boolean(ready && navigator.canShare?.({ files: [ready.file] }));

  function download() {
    if (!ready) return;
    const a = document.createElement('a');
    a.href = ready.url;
    a.download = ready.file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function share() {
    if (!ready) return;
    if (!canShare) return download();
    navigator.share({ files: [ready.file] }).catch((e: Error) => {
      if (e.name !== 'AbortError') download(); // "AbortError" = a pessoa desistiu
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center">
      <div aria-hidden="true" className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compartilhar-mes-titulo"
        tabIndex={-1}
        className="relative flex max-h-[94dvh] w-full max-w-[440px] flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-papel p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-tinta md:rounded-[28px]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="compartilhar-mes-titulo" className="font-display text-[22px] leading-7 font-extrabold">
            Seu {monthName} em imagem
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-11 shrink-0 items-center px-2 text-sm font-semibold text-tinta-suave"
          >
            Fechar
          </button>
        </div>

        <div className="mx-auto aspect-[9/16] h-[46dvh] max-h-[560px] min-h-[240px] overflow-hidden rounded-2xl bg-papel-2">
          {ready ? (
            <img src={ready.url} alt={`Prévia do resumo de ${monthName}`} className="h-full w-full object-contain" />
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
              <p role="alert" className="text-sm leading-5">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="h-11 rounded-full border-[1.5px] border-tinta px-5 text-sm font-semibold"
              >
                Tentar de novo
              </button>
            </div>
          ) : (
            <p role="status" className="flex h-full animate-pulse items-center justify-center text-sm text-tinta-suave">
              Desenhando…
            </p>
          )}
        </div>

        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-linha bg-cartao px-4 py-2">
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold">Mostrar valores em R$</span>
            <span className="text-xs leading-[18px] text-tinta-suave">
              Desligado, vai só porcentagem. Seu nome e e-mail nunca vão.
            </span>
          </span>
          <input
            type="checkbox"
            checked={showValues}
            onChange={(e) => setShowValues(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-laranja"
          />
        </label>

        <button
          type="button"
          onClick={share}
          disabled={!ready}
          className="h-[54px] shrink-0 rounded-full bg-tinta text-base font-semibold text-papel disabled:opacity-50"
        >
          {canShare || !ready ? 'Compartilhar imagem' : 'Baixar imagem'}
        </button>
        {canShare && (
          <button type="button" onClick={download} className="min-h-11 shrink-0 text-sm font-semibold text-tinta-suave">
            Baixar no aparelho
          </button>
        )}
      </div>
    </div>
  );
}

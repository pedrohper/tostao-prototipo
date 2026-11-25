'use client';
// Acertos → "Cobrar no Pix" (T6.16): um toque copia o código do valor devido e abre o WhatsApp com a mensagem pronta.
import { useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

const HINT: Record<CopyState, string> = {
  idle: 'Copio o Pix do valor certinho e abro o WhatsApp com a mensagem pronta.',
  copied: 'Pix copiado! Manda a mensagem e depois cola o código na conversa.',
  failed: 'Não consegui copiar sozinho. Segura no código aqui embaixo pra copiar.',
};

export function CobrarPix({ code, message }: { code: string; message: string }) {
  const [copy, setCopy] = useState<CopyState>('idle');
  const [open, setOpen] = useState(false);

  // O navegador só libera a área de transferência dentro do toque: nada de esperar antes do writeText.
  const copiar = () => {
    const fail = () => {
      setCopy('failed');
      setOpen(true);
    };
    const done = navigator.clipboard?.writeText(code);
    if (!done) return fail();
    done.then(() => setCopy('copied'), fail);
  };

  return (
    <div className="flex flex-col gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={copiar}
        className="flex h-[54px] items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel no-underline active:translate-y-px"
      >
        Cobrar no Pix
      </a>
      <p role="status" aria-live="polite" className="text-center text-[13px] leading-[18px] text-tinta-suave">
        {HINT[copy]}
      </p>
      <details
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
        className="rounded-2xl border border-linha bg-cartao px-3.5"
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-tinta">
          Ver o Pix copia e cola
        </summary>
        <div className="flex flex-col gap-2 pb-3.5">
          <code className="rounded-xl bg-papel-2 p-3 font-mono text-xs leading-[18px] break-all select-all">
            {code}
          </code>
          <button
            type="button"
            onClick={copiar}
            className="h-11 rounded-full border-[1.5px] border-tinta text-sm font-semibold text-tinta"
          >
            Copiar código
          </button>
        </div>
      </details>
    </div>
  );
}

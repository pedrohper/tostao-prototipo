'use client';
import { useState } from 'react';

/** Copia o link de cadastro já com o código preenchido. */
export function CopyLink({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="text-[13px] font-semibold text-laranja-texto underline"
      onClick={async () => {
        await navigator.clipboard.writeText(`${location.origin}/criar-conta?convite=${code}`);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}>
      {done ? 'Copiado!' : 'Copiar link'}
    </button>
  );
}

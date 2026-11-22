'use client';
import { useState } from 'react';
import { useToast } from '@/components/toast';

/** Texto que a pessoa precisa colar no app Atalhos (URL, cabeçalho, corpo JSON), com botão de copiar. */
export function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">{label}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
            } catch {
              toast.error('Não consegui copiar. Segure o texto e copie na mão.');
              return;
            }
            setDone(true);
            toast.success('Copiado.');
            setTimeout(() => setDone(false), 2000);
          }}
          className="h-9 px-2 text-[13px] font-semibold text-laranja-texto underline"
        >
          {done ? 'Copiado ✓' : 'Copiar'}
        </button>
      </div>
      <pre
        className={`${multiline ? 'whitespace-pre-wrap' : 'whitespace-pre-wrap'} overflow-x-auto rounded-xl bg-papel-2 px-3 py-2.5 text-[12px] leading-[18px] [overflow-wrap:anywhere] select-all`}
      >
        {value}
      </pre>
    </div>
  );
}

'use client';
import { useActionState } from 'react';
import type { Dictionary } from '@/lib/i18n';
import { createCode, type CodeState } from './actions';

export function CodeCard({ t }: { t: Dictionary['pages']['whatsapp']['codeCard'] }) {
  const [state, action, pending] = useActionState<CodeState>(createCode, {});
  if (state.code) {
    const link = state.number
      ? `https://wa.me/${state.number}?text=${encodeURIComponent(`TOSTAO ${state.code}`)}`
      : null;
    return (
      <div className="flex flex-col items-center gap-3 rounded-[20px] border border-linha bg-cartao p-5 text-center">
        <span className="text-sm text-tinta-suave">{t.prompt}</span>
        <span className="mascote-pula font-display text-[40px] font-extrabold tracking-[0.18em] tabular-nums">
          {state.code}
        </span>
        <span className="text-xs text-tinta-suave">{t.expiresIn}</span>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="flex h-[50px] w-full items-center justify-center rounded-full bg-menta text-[15px] font-semibold text-tinta-fixa no-underline"
          >
            {t.openWhatsapp}
          </a>
        )}
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="h-[50px] rounded-full bg-tinta text-[15px] font-semibold text-papel disabled:opacity-60"
      >
        {pending ? t.generating : t.generate}
      </button>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-vermelho-texto">
          {state.error}
        </p>
      )}
    </form>
  );
}

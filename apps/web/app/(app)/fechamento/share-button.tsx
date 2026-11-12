'use client';
import { useState } from 'react';

/** Compartilha um resumo em texto (sem valores, que é coisa sua). */
export function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); }
    } catch { /* cancelou */ }
  }
  return (
    <button type="button" onClick={share} className="h-[52px] rounded-full border-2 border-[#1E1B18] text-[15px] font-bold text-[#1E1B18]">
      {copied ? 'Copiado!' : 'Compartilhar'}
    </button>
  );
}

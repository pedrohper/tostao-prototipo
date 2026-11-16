'use client';
import { useState } from 'react';
import { getDictionary } from '@/lib/i18n';

/** Compartilha um resumo em texto (sem valores, que é coisa sua). */
export function ShareButton({ text, shareLabel, copiedLabel }: { text: string; shareLabel?: string; copiedLabel?: string }) {
  const defaults = getDictionary('pt-BR').pages.fechamento;
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); }
    } catch { /* cancelou */ }
  }
  return (
    <button type="button" onClick={share} className="h-[52px] rounded-full border-2 border-tinta-fixa text-[15px] font-bold text-tinta-fixa">
      {copied ? (copiedLabel ?? defaults.copiedBtn) : (shareLabel ?? defaults.shareBtn)}
    </button>
  );
}

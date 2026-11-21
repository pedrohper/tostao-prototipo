'use client';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { filenameFromDisposition } from '@/lib/export-proxy';

/**
 * "Baixar meus dados (JSON)": LGPD art. 18, V. Busca o arquivo pelo BFF (`/api/me/export`) e dispara o download.
 * Feito por fetch (e não por link) pra que o limite de 2 por dia apareça como aviso, em vez de baixar um JSON de erro.
 * Erros usam o toast global (T4.1).
 */
export function ExportDataButton({
  label,
  busyLabel,
  successMessage,
  errorMessage,
  className,
}: {
  label: string;
  busyLabel: string;
  successMessage: string;
  errorMessage: string;
  className?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch('/api/me/export', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        // 429 traz "Tenta de novo daqui a N horas": mostra como veio. Outros erros: mensagem genérica.
        toast.error(res.status === 429 && body?.message ? body.message : errorMessage);
        return;
      }
      const blob = await res.blob();
      const name = filenameFromDisposition(res.headers.get('content-disposition'), 'tostao-meus-dados.json');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(successMessage);
    } catch {
      toast.error(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={download} disabled={busy} aria-busy={busy} className={className}>
      {busy ? busyLabel : label}
    </button>
  );
}

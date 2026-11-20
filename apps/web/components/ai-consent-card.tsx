'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAiConsentAction } from '@/lib/consent-actions';

/**
 * Aviso de uso de IA (LGPD): explica o que sai do Tostão, pra quem, e só libera depois do aceite explícito.
 * Aparece no /tostao e dentro do botão "Categorizar pra mim".
 */
export function AiConsentCard({ onAccepted, compact = false }: { onAccepted?: () => void; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const accept = () =>
    start(async () => {
      const r = await setAiConsentAction(true);
      if (!r.ok) return setError(r.error);
      setError(null);
      onAccepted?.();
      router.refresh();
    });

  return (
    <section
      aria-labelledby="ai-consent-title"
      className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-amarelo-claro p-4 text-tinta"
    >
      <h2 id="ai-consent-title" className={`m-0 font-bold ${compact ? 'text-[15px]' : 'text-[17px]'}`}>
        Antes de usar a IA do Tostão
      </h2>
      <p className="m-0 text-[14px] leading-[21px]">
        Pra responder e categorizar, o Tostão envia a um provedor de IA (DeepSeek) um resumo do seu dinheiro: saldos,
        valores, categorias e as descrições do extrato, com CPF, e-mail, telefone, números de conta/cartão e nomes em
        Pix <strong>mascarados</strong> antes de sair. Só o seu primeiro nome vai junto. Contas ocultas não são
        enviadas.
      </p>
      <p className="m-0 text-[14px] leading-[21px]">
        A IA <strong>nunca grava nada sozinha</strong>: qualquer lançamento sugerido só vale depois do seu
        &ldquo;confirmar&rdquo;. Você pode desativar quando quiser. Detalhes na{' '}
        <Link href="/privacidade" className="font-semibold underline">
          Política de Privacidade
        </Link>
        .
      </p>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-vermelho-texto">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={accept}
        disabled={pending}
        className="self-start rounded-full bg-tinta px-5 py-2.5 text-[14px] font-semibold text-papel disabled:opacity-60"
      >
        {pending ? 'Salvando…' : 'Li e aceito usar a IA'}
      </button>
    </section>
  );
}

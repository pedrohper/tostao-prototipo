'use client';
import { Mascot, type MascotPose } from '@/components/mascote';

/**
 * Tela de erro/vazio com a cara do Tostão. Usada pelos error boundaries e pelo 404 (e a /offline).
 * Nunca recebe a mensagem do erro: ela pode ter detalhe interno, e a pessoa não precisa ver isso. O `digest`
 * (código curto que o Next gera) aparece pequeno só pra ela poder passar pro suporte.
 */
export function ErrorScreen({
  title,
  body,
  pose = 'preocupado',
  retryLabel,
  onRetry,
  homeLabel,
  homeHref = '/inicio',
  digest,
  fullPage = false,
}: {
  title: string;
  body: string;
  pose?: MascotPose;
  retryLabel?: string;
  onRetry?: () => void;
  homeLabel?: string;
  homeHref?: string;
  digest?: string;
  /** Fora do layout do app (global-error, not-found raiz): ocupa a tela inteira. */
  fullPage?: boolean;
}) {
  return (
    <main
      role="alert"
      className={`mx-auto flex w-full max-w-[420px] flex-col items-center justify-center gap-5 px-6 py-12 text-center ${
        fullPage ? 'min-h-dvh' : 'min-h-[60dvh]'
      }`}
    >
      <Mascot pose={pose} size={132} still />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[26px] leading-[30px] font-extrabold text-tinta">{title}</h1>
        <p className="text-[15px] leading-[22px] text-tinta-suave">{body}</p>
      </div>
      <div className="flex w-full flex-col gap-2.5">
        {onRetry && retryLabel && (
          <button
            type="button"
            onClick={onRetry}
            className="flex h-[50px] items-center justify-center rounded-full bg-laranja text-[15px] font-semibold text-tinta-fixa"
          >
            {retryLabel}
          </button>
        )}
        {homeLabel && (
          <a
            href={homeHref}
            className="flex h-[50px] items-center justify-center rounded-full border-[1.5px] border-tinta text-[15px] font-semibold text-tinta no-underline"
          >
            {homeLabel}
          </a>
        )}
      </div>
      {digest && <p className="text-[12px] text-tinta-suave">{`Código: ${digest}`}</p>}
    </main>
  );
}

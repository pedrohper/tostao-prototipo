import Link from 'next/link';
import { Mascot } from '@/components/mascote';

/**
 * "Antes de mexer" (T6.14): ensina antes do simulador. Fechado, diz em uma frase o que a pessoa vai entender; aberto,
 * traz o conceito da lição (o mesmo texto do passo "A ideia") e o caminho pra lição completa.
 */
export function AntesDeMexer({
  aprende,
  conceito,
  hrefDaLicao,
}: {
  aprende: string;
  conceito: string;
  hrefDaLicao: string;
}) {
  return (
    <details className="group rounded-[20px] bg-amarelo-claro">
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-[20px] p-4 [&::-webkit-details-marker]:hidden">
        <Mascot pose="professor" size={56} alt="" still />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-display text-[18px] leading-[22px] font-extrabold">Antes de mexer</span>
          <span className="text-[14px] leading-[20px] text-tinta">{aprende}</span>
          <span className="text-[13px] font-bold text-laranja-texto">
            <span className="group-open:hidden">Ler a ideia</span>
            <span className="group-not-open:hidden">Fechar</span>
          </span>
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mt-0.5 shrink-0 transition-transform group-open:rotate-180"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="rounded-2xl bg-cartao p-4 text-[15px] leading-relaxed">{conceito}</p>
        <Link
          href={hrefDaLicao}
          className="flex h-11 items-center justify-center rounded-full bg-tinta text-sm font-semibold text-papel no-underline"
        >
          Ver a lição completa
        </Link>
      </div>
    </details>
  );
}

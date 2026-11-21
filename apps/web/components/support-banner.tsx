import { Mascot } from '@/components/mascote';
import { getLegalConfig } from '@/lib/legal-config';

/** Faixa de ajuda (Mais, Sobre). Só aparece se NEXT_PUBLIC_SUPPORT_EMAIL estiver configurado: nunca inventa um contato. */
export function SupportBanner({ text }: { text: string }) {
  const { supportEmail } = getLegalConfig();
  if (!supportEmail) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-amarelo-claro px-4 py-3">
      <Mascot pose="caramelo-moeda" size={52} alt="" />
      <p className="min-w-0 text-[13px] leading-[19px] text-tinta">
        {text}{' '}
        <a href={`mailto:${supportEmail}`} className="font-semibold underline">
          {supportEmail}
        </a>
      </p>
    </div>
  );
}

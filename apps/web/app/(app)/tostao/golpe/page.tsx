import { GolpeForm } from '@/components/golpe-form';
import { Mascot } from '@/components/mascote';
import { BackLink, PageFrame } from '@/components/ui';
import { getMe } from '@/lib/api-queries';
import { resolveBackHref } from '@/lib/format';

/** "Isso é golpe?" (T6.20): atalho do /tostao pra colar uma mensagem recebida e conferir os sinais. */
export default async function GolpePage({ searchParams }: { searchParams?: Promise<{ voltar?: string }> }) {
  const [sp, me] = await Promise.all([searchParams ?? Promise.resolve<{ voltar?: string }>({}), getMe()]);
  return (
    <PageFrame size="focused">
      <div className="flex items-center gap-1">
        <BackLink href={resolveBackHref(sp.voltar, '/tostao')} />
        <h1 className="font-display text-[24px] leading-[30px] font-extrabold text-tinta">Isso é golpe?</h1>
      </div>
      <div className="flex items-center gap-3 rounded-[20px] bg-amarelo-claro p-4 text-tinta">
        <Mascot pose="urubu-pix" size={72} alt="Urubu do Pix" />
        <p className="text-[14px] leading-[20px]">
          Recebeu uma mensagem estranha? Cola aqui <b>antes</b> de clicar, responder ou mandar Pix. Eu aponto os sinais
          que o Urubu do Pix costuma deixar.
        </p>
      </div>
      <GolpeForm consented={Boolean(me.aiConsentAt)} />
    </PageFrame>
  );
}

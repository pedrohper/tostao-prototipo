import type { TribunalResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Mascote } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import { Rich, Voto } from './voto';

/** Tribunal do Tostão: um caso por semana, a galera vota e o Tostão dá o veredito. */
export default async function TribunalPage() {
  const t = await api<TribunalResponse>('/tribunal');
  const fim = new Date(t.endsAt).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).replace('-feira', '');
  return (
    <div className="flex min-h-[calc(100dvh-160px)] flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <BackLink href="/aprender" />
        <span className="text-xs font-semibold text-tinta-suave">Encerra {fim} · {t.totalVotes} {t.totalVotes === 1 ? 'voto' : 'votos'}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <Mascote pose="pensando" size={76} alt="Tostão pensando" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold tracking-[0.08em] text-laranja-texto uppercase">Tribunal do Tostão</span>
          <h1 className="font-display text-[26px] leading-[30px] font-extrabold">{t.case.title}</h1>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-[18px] border border-linha bg-cartao px-4 py-3.5">
        <span className="text-[13px] font-semibold text-tinta-suave">O caso da semana</span>
        <p className="text-[15px] leading-[22px]"><Rich text={t.case.story} /></p>
      </div>
      <Voto initial={t} />
    </div>
  );
}

import type { FriendsResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { nowMs, resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { Icon } from '@/components/icone';
import { BackLink, Eyebrow, PageFrame } from '@/components/ui';
import { AdicionarAmigo, Compartilhar, Remover } from './client';

const MEDALHA = ['bg-amarelo text-tinta-fixa', 'bg-papel-2 text-tinta', 'bg-bronze text-tinta-fixa'];

export default async function AmigosPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [{ voltar }, f, { t }] = await Promise.all([searchParams, api<FriendsResponse>('/friends'), getI18n()]);
  const am = t.pages.amigos;
  const fim = new Date(f.challenge.endsAt);
  const dias = Math.max(0, Math.ceil((fim.getTime() - nowMs()) / 86_400_000));
  const sozinho = f.ranking.length <= 1;
  const backHref = resolveBackHref(voltar, '/aprender');

  return (
    <PageFrame size="focused">
      <BackLink href={backHref} label={t.common.back} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{am.title}</h1>
          <p className="text-sm leading-5 text-tinta-suave">{f.challenge.title}. {dias === 0 ? am.endsToday : am.endsInDays(dias)}{am.endsSuffix}</p>
        </div>
        <Mascot pose="dupla" size={92} alt="Tostão e Caramelo" />
      </div>

      <section className="flex flex-col gap-2">
        <Eyebrow>{am.rankingTitle}</Eyebrow>
        <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
          {f.ranking.map((p, i) => (
            <div key={p.id} className={`flex min-h-[58px] items-center gap-3 border-b border-linha last:border-b-0 ${p.me ? 'font-bold' : ''}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${MEDALHA[i] ?? 'bg-papel-2 text-tinta'}`}>{i + 1}</span>
              <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-[15px]">{p.me ? am.youSuffix(p.name) : p.name}</span>
                <span className="flex items-center gap-1 text-xs font-normal text-tinta-suave"><Icon src="ui/ofensiva" size={14} />{am.streakLabel(p.streakDays)}</span>
              </span>
              <span className="shrink-0 text-[15px] tabular-nums">{p.weekScore} <span className="text-xs font-normal text-tinta-suave">{am.missionsUnit}</span></span>
              {!p.me && <Remover id={p.id} name={p.name} t={am.client} />}
            </div>
          ))}
        </div>
        {sozinho && <p className="text-[13px] text-tinta-suave">{am.aloneNote}</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-amarelo-claro p-3.5 text-tinta">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold">{am.yourCode}</span>
          <span className="font-mono text-[17px] font-bold tracking-wide">{f.code}</span>
        </div>
        <Compartilhar code={f.code} t={am.client} />
      </section>

      <AdicionarAmigo t={am.client} />

      <p className="flex gap-2 rounded-2xl bg-papel-2 p-3 text-[13px] leading-[19px] text-tinta-suave">
        <Icon src="modulo/9" size={22} />
        {am.privacyNote}
      </p>
    </PageFrame>
  );
}

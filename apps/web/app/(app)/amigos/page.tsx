import type { FriendsResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Mascote } from '@/components/mascote';
import { Icone } from '@/components/icone';
import { BackLink, Eyebrow } from '@/components/ui';
import { AdicionarAmigo, Compartilhar, Remover } from './client';

const MEDALHA = ['bg-amarelo', 'bg-papel-2', 'bg-[#F5CDB8]'];

export default async function AmigosPage() {
  const f = await api<FriendsResponse>('/friends');
  const fim = new Date(f.challenge.endsAt);
  const dias = Math.max(0, Math.ceil((fim.getTime() - Date.now()) / 86_400_000));
  const sozinho = f.ranking.length <= 1;
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/aprender" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Desafio com amigos</h1>
          <p className="text-sm leading-5 text-tinta-suave">{f.challenge.title}. Acaba {dias === 0 ? 'hoje' : `em ${dias} ${dias === 1 ? 'dia' : 'dias'}`}, domingo à noite.</p>
        </div>
        <Mascote pose="dupla" size={92} alt="Tostão e Caramelo" />
      </div>

      <section className="flex flex-col gap-2">
        <Eyebrow>Placar da semana</Eyebrow>
        <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
          {f.ranking.map((p, i) => (
            <div key={p.id} className={`flex min-h-[58px] items-center gap-3 border-b border-linha last:border-b-0 ${p.me ? 'font-bold' : ''}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#1E1B18] ${MEDALHA[i] ?? 'bg-papel-2'}`}>{i + 1}</span>
              <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-[15px]">{p.me ? `${p.name} (você)` : p.name}</span>
                <span className="flex items-center gap-1 text-xs font-normal text-tinta-suave"><Icone src="ui/ofensiva" size={14} />{p.streakDays} {p.streakDays === 1 ? 'dia' : 'dias'} de ofensiva</span>
              </span>
              <span className="shrink-0 text-[15px] tabular-nums">{p.weekScore} <span className="text-xs font-normal text-tinta-suave">missões</span></span>
              {!p.me && <Remover id={p.id} name={p.name} />}
            </div>
          ))}
        </div>
        {sozinho && <p className="text-[13px] text-tinta-suave">Por enquanto é só você. Chama alguém pra ter com quem disputar.</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-amarelo-claro p-3.5 text-[#1E1B18]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold">Seu código</span>
          <span className="font-mono text-[17px] font-bold tracking-wide">{f.code}</span>
        </div>
        <Compartilhar code={f.code} />
      </section>

      <AdicionarAmigo />

      <p className="flex gap-2 rounded-2xl bg-papel-2 p-3 text-[13px] leading-[19px] text-tinta-suave">
        <Icone src="modulo/9" size={22} />
        Amigo vê só seu primeiro nome, a ofensiva e quantas missões você fez. Saldo, gastos e banco ficam só com você.
      </p>
    </div>
  );
}

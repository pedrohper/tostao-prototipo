import type { BattlesResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Mascote } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import { Confete } from '@/components/confete';
import { startTigrinho, toggleUrubuStep } from './actions';

const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' });
const branco = 'flex flex-col gap-2.5 rounded-[18px] bg-[#FFFDF9] px-4 py-3.5 text-[#1E1B18]';

/** Batalha contra o Tigrinho: 30 dias sem bet, conferido no extrato. Depois, o Urubu do Pix. */
export default async function BatalhaPage() {
  const b = await api<BattlesResponse>('/battles');
  const t = b.tigrinho;
  const status = t?.status ?? 'nova';
  const vida = t ? (t.status === 'vencida' ? 0 : t.status === 'perdida' ? 100 : Math.round(((t.totalDays - t.day + 1) / t.totalDays) * 100)) : 100;
  const titulo = status === 'vencida' ? 'Tigrinho derrotado!' : status === 'perdida' ? 'O Tigrinho levou essa' : '30 dias sem dar um centavo pro Tigrinho';

  return (
    <div className="-mx-5 -mt-12 -mb-28 flex min-h-dvh flex-col gap-3.5 bg-amarelo-claro px-5 pt-12 pb-32 text-[#1E1B18] md:-mx-8 md:px-8">
      {status === 'vencida' && b.urubu.status !== 'vencida' && <Confete />}
      <div className="flex items-center justify-between">
        <BackLink href="/aprender" />
        <span className="text-xs font-bold tracking-[0.08em] text-[#C2410C] uppercase">
          {t && status === 'ativa' ? `Batalha · dia ${t.day} de ${t.totalDays}` : 'Batalha'}
        </span>
      </div>
      <h1 className="font-display text-[28px] leading-8 font-extrabold">{titulo}</h1>

      <div className="relative flex h-[210px] items-end justify-between">
        <Mascote pose={status === 'perdida' ? 'caramelo-dormindo' : 'caramelo-bravo'} size={160} alt="Caramelo rosnando" />
        <span className="absolute top-[70px] left-1/2 -translate-x-1/2 -rotate-6 font-display text-[34px] font-extrabold text-laranja [-webkit-text-stroke:1.5px_#1E1B18]">VS</span>
        <img src="/elenco/tigrinho.webp" alt="Tigrinho de óculos escuros" width={190} height={190} className={`shrink-0 ${status === 'vencida' ? 'rotate-12 opacity-40 grayscale' : 'mascote'}`} />
      </div>

      {t && status !== 'nova' && (
        <div className={branco}>
          <div className="flex items-baseline justify-between"><span className="text-sm font-bold">Vida do Tigrinho</span><span className="text-[13px] font-semibold text-[#6B635A]">{vida}% restante</span></div>
          <div className="h-3.5 overflow-hidden rounded-full bg-[#F6EFE4]"><div className="bar-fill h-full rounded-full bg-laranja" style={{ width: `${vida}%` }} /></div>
          <div className="grid grid-cols-10 gap-[5px]" role="img" aria-label={`${status === 'vencida' ? t.totalDays : t.day - 1} de ${t.totalDays} dias cumpridos`}>
            {Array.from({ length: t.totalDays }, (_, i) => {
              const feito = status === 'vencida' || i < t.day - 1;
              const hoje = status === 'ativa' && i === t.day - 1;
              return <i key={i} className={`aspect-square rounded-full ${feito ? 'bg-menta' : hoje ? 'border-2 border-[#1E1B18]' : status === 'perdida' && i === t.day - 1 ? 'bg-[#B42318]' : 'bg-[#F6EFE4]'}`} />;
            })}
          </div>
        </div>
      )}

      {status === 'nova' && (
        <div className={branco}>
          <p className="text-[15px] leading-[22px]">Aposta é feita pra casa ganhar. O desafio: <b>30 dias sem nenhum Pix ou compra em casa de aposta</b>. Eu confiro no seu extrato toda manhã, você não precisa fazer nada.</p>
          <p className="text-[13px] leading-[18px] text-[#6B635A]">Se escorregar, sem julgamento: dá pra recomeçar quando quiser.</p>
        </div>
      )}

      {t && status !== 'nova' && (
        <div className="flex items-start gap-2.5 rounded-[18px] bg-[#FFFDF9] px-3.5 py-3">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${status === 'perdida' ? 'bg-rosa' : 'bg-menta-clara'}`}>
            {status === 'perdida'
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E1B18" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E1B18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>}
          </div>
          <p className="text-sm leading-5">
            {status === 'perdida' && t.lostAt ? <><b>Apareceu uma aposta no extrato</b> em {dia(t.lostAt)}. Acontece. O importante é não correr atrás do prejuízo.</>
              : !b.checksStatement ? <><b>Sem banco conectado,</b> eu não consigo conferir sozinho. Vale a sua palavra (e anotar os gastos ajuda).</>
              : status === 'vencida' ? <><b>30 dias limpos, conferido no extrato.</b> +100 XP pra você.</>
              : <><b>Conferido no extrato:</b> nenhum Pix pra casa de aposta desde {dia(t.startedAt)}. O Tostão olha sozinho toda manhã.</>}
          </p>
        </div>
      )}

      {(status === 'nova' || status === 'perdida') && (
        <form action={startTigrinho}>
          <button type="submit" className="flex h-[54px] w-full items-center justify-center rounded-full bg-laranja text-base font-bold text-[#1E1B18] shadow-[0_2px_0_rgba(30,27,24,0.14)]">
            {status === 'nova' ? 'Topo a batalha' : 'Recomeçar do dia 1'}
          </button>
        </form>
      )}

      <div className="grow" />
      <section className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-[0.08em] text-[#6B635A] uppercase">{b.urubu.status === 'bloqueada' ? 'Próxima batalha' : 'Batalha 2'}</span>
        <div className="flex flex-col rounded-2xl bg-[#FFFDF9]">
          <div className="flex items-center gap-2 py-2 pr-3.5 pl-1.5">
            <Mascote pose={b.urubu.status === 'vencida' ? 'urubu-fugindo' : 'urubu-pix'} size={52} alt="Urubu do Pix" still />
            <div className="flex grow flex-col"><span className="text-[15px] font-bold">Urubu do Pix{b.urubu.status === 'vencida' ? ' · derrotado' : ''}</span><span className="text-xs text-[#6B635A]">Ativar a proteção do Pix no seu banco</span></div>
            {b.urubu.status === 'bloqueada' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B635A" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Bloqueado: vence o Tigrinho primeiro"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>}
          </div>
          {b.urubu.status !== 'bloqueada' && b.urubu.steps.map((s) => (
            <form key={s.id} action={toggleUrubuStep} className="border-t border-[#E4DCCF]">
              <input type="hidden" name="stepId" value={s.id} />
              <input type="hidden" name="done" value={String(!s.done)} />
              <button type="submit" aria-pressed={s.done} className="flex min-h-12 w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm leading-5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] ${s.done ? 'border-menta bg-menta' : 'border-[#E4DCCF]'}`} aria-hidden="true">
                  {s.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1E1B18" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
                </span>
                <span className={s.done ? 'text-[#6B635A] line-through' : ''}>{s.label}</span>
              </button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}

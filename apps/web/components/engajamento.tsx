import Link from 'next/link';
import type { ForecastResponse, MissionsResponse, ReminderDTO, WeeklyResponse } from '@tostao/contracts';
import { money, monthName } from '@/lib/format';
import { Icone } from './icone';
import { fecharAviso } from '@/lib/inicio-actions';

const chevron = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-tinta-suave"><path d="M9 18l6-6-6-6" /></svg>;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DIAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/** Missões de hoje: fazer qualquer uma garante a ofensiva do dia. */
export function Missoes({ data, compact = false }: { data: MissionsResponse; compact?: boolean }) {
  const feitas = data.missions.filter((m) => m.done).length;
  return (
    <section className="relative flex flex-col gap-2.5 rounded-[18px] border border-linha bg-cartao p-3.5">
      {/* O card inteiro leva pro Aprender; cada missão por cima leva pro lugar dela. */}
      <Link href="/aprender" aria-label="Ver missões e ofensiva" className="absolute inset-0 rounded-[18px]" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Missões de hoje · {feitas}/{data.missions.length} ›</span>
        <span className="flex items-center gap-1 text-[13px] font-bold"><Icone src="ui/ofensiva" size={18} />{data.streakDays} {data.streakDays === 1 ? 'dia' : 'dias'}</span>
      </div>
      <ul className="flex flex-col">
        {data.missions.map((m) => (
          <li key={m.id} className="relative z-[1]">
            <Link href={m.href} className="flex min-h-11 items-center gap-2.5 text-tinta no-underline">
              {m.done
                ? <Icone src="jogo/dia-cumprido" size={24} alt="feita" />
                : <span aria-label="a fazer" className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-tinta-suave" />}
              <span className={`grow text-[15px] ${m.done ? 'text-tinta-suave line-through' : 'font-semibold'}`}>{m.title}</span>
              {!m.done && chevron}
            </Link>
          </li>
        ))}
      </ul>
      {!compact && (
        <div className="flex items-center justify-between gap-1 border-t border-linha pt-2.5" role="img" aria-label={`Semana: ${data.week.filter((d) => d.done > 0).length} de 7 dias com missão`}>
          {data.week.map((d, i) => (
            <span key={d.day} className="flex flex-col items-center gap-1 text-[11px] font-semibold text-tinta-suave">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${d.done > 0 ? 'bg-laranja' : 'bg-papel-2'}`}>
                {d.done > 0 && <Icone src="ui/ofensiva" size={16} />}
              </span>
              {DIAS[i]}
            </span>
          ))}
        </div>
      )}
      <p className="text-[13px] text-tinta-suave">
        {data.todayKept ? 'Ofensiva de hoje garantida. As outras missões dão XP extra.' : 'Uma missão já segura a ofensiva de hoje.'}
      </p>
    </section>
  );
}

const QUANDO = (d: number) => (d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`);
const KIND_ICON: Record<ReminderDTO['kind'], string> = { fatura: 'ui/cartao', conta: 'cat/casa', assinatura: 'cat/assinaturas' };

/** Pra onde cada aviso leva: fatura abre o cartão, conta fixa abre a renda, assinatura abre a lista. */
const destinoAviso = (r: ReminderDTO) => {
  if (r.kind === 'fatura') { const id = r.key.split(':')[1]; return id ? `/carteira/conta/${id}` : '/carteira'; }
  return r.kind === 'assinatura' ? '/assinaturas' : '/renda';
};

/** O que vence nos próximos 7 dias. */
export function VenceLogo({ reminders }: { reminders: ReminderDTO[] }) {
  if (!reminders.length) return null;
  return (
    <section id="vence" className="flex scroll-mt-4 flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl leading-[26px] font-extrabold">Vence logo</h2>
        <Link href="/perfil#avisos" className="text-[13px] font-semibold text-laranja-texto">Me avisar</Link>
      </div>
      <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
        {reminders.slice(0, 4).map((r) => (
          <div key={r.key} className="flex min-h-[54px] items-center gap-1 border-b border-linha last:border-b-0">
            <Link href={destinoAviso(r)} className="flex min-h-[54px] min-w-0 grow items-center gap-3 text-tinta no-underline">
              <Icone src={KIND_ICON[r.kind]} size={28} />
              <div className="flex min-w-0 grow flex-col">
                <span className="truncate text-[15px] font-semibold">{r.title}</span>
                <span className={`text-xs ${r.daysLeft <= 1 ? 'font-semibold text-laranja-texto' : 'text-tinta-suave'}`}>Vence {QUANDO(r.daysLeft)}</span>
              </div>
              {r.amountInCents !== null && <span className="shrink-0 text-[15px] font-semibold tabular-nums">{money(r.amountInCents)}</span>}
            </Link>
            <form action={fecharAviso.bind(null, r.key)} className="-mr-2 shrink-0">
              <button type="submit" aria-label={`Já paguei ${r.title}, fechar`} title="Já paguei"
                className="flex h-9 w-9 items-center justify-center rounded-full text-tinta-suave hover:bg-tinta/10">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Últimos 7 dias contra os 7 anteriores. */
export function Semana({ w }: { w: WeeklyResponse }) {
  if (!w.spentInCents && !w.prevSpentInCents && !w.missionsDone) return null;
  const diff = w.spentInCents - w.prevSpentInCents;
  const melhor = diff <= 0;
  return (
    <Link href="/carteira?filtro=saidas#lista" id="semana" className="flex scroll-mt-4 flex-col gap-2 rounded-2xl bg-azul p-3.5 pr-10 text-tinta no-underline">
      <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Sua semana · últimos 7 dias ›</span>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-[28px] leading-8 font-extrabold tabular-nums">{money(w.spentInCents)}</span>
        {w.prevSpentInCents > 0 && (
          <span className={`rounded-full px-2.5 py-1 text-[13px] font-bold ${melhor ? 'bg-menta text-[#1E1B18]' : 'bg-rosa'}`}>
            {melhor ? '↓' : '↑'} {money(Math.abs(diff))}
          </span>
        )}
      </div>
      <p className="text-[14px] leading-5">
        {w.prevSpentInCents > 0
          ? <>{melhor ? 'A menos' : 'A mais'} que nos 7 dias antes ({money(w.prevSpentInCents)}).</>
          : 'Semana que vem eu já comparo com essa.'}
        {w.top && <> Onde mais foi: <b>{w.top.name}</b> ({money(w.top.totalInCents)}).</>}
        {' '}{w.missionsDone} {w.missionsDone === 1 ? 'missão feita' : 'missões feitas'}.
      </p>
    </Link>
  );
}

/** Quanto deve sobrar até o fim do mês + o mês que vem. */
export function Sobra({ forecast }: { forecast: ForecastResponse }) {
  const t = forecast.thisMonth;
  const prox = forecast.months[0];
  if (!t) return null;
  const sobra = t.leftInCents >= 0;
  return (
    <Link href="/previsao" className={`flex items-center gap-3 rounded-2xl p-3.5 text-tinta no-underline ${sobra ? 'bg-menta-clara' : 'bg-rosa'}`}>
      <div className="flex grow flex-col gap-1">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Até o fim de {monthName(t.month)}</span>
        <span className="text-[15px] leading-[21px]">
          {sobra ? <>Devem sobrar uns <b className="font-display text-[22px] font-extrabold">{money(t.leftInCents)}</b></> : <>Devem faltar uns <b className="font-display text-[22px] font-extrabold">{money(-t.leftInCents)}</b></>}
        </span>
        <span className="text-[13px] text-tinta-suave">
          {t.daysLeft} {t.daysLeft === 1 ? 'dia' : 'dias'} pela frente · já saiu {money(t.spentInCents)}
          {t.fixedLeftInCents + t.subscriptionsLeftInCents > 0 ? ` · ainda vem ${money(t.fixedLeftInCents + t.subscriptionsLeftInCents)} de contas` : ''}
        </span>
        {prox && <span className="text-[13px] text-tinta-suave">{cap(monthName(prox.month))}: {prox.leftInCents >= 0 ? `sobram uns ${money(prox.leftInCents)}` : `faltam uns ${money(-prox.leftInCents)}`}</span>}
      </div>
      {chevron}
    </Link>
  );
}

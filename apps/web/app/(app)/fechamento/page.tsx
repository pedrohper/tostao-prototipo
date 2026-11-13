import { Visita } from '@/components/visita';
import Link from 'next/link';
import type { LessonProgressResponse, MonthSummaryResponse, SubscriptionsResponse, TransactionDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth, money, monthName, shiftMonth } from '@/lib/format';
import { Mascote } from '@/components/mascote';
import { NO_PROGRESS, xpFrom } from '@/lib/xp';
import { ShareButton } from './share-button';
import { Cartas } from './cartas';

const pct = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);

function Delta({ now, before, goodWhenDown = true }: { now: number; before: number; goodWhenDown?: boolean }) {
  const p = pct(now, before);
  if (p === null || p === 0) return <span className="text-xs text-[#6B635A]">igual ao mês anterior</span>;
  const good = goodWhenDown ? p < 0 : p > 0;
  return <span className={`text-xs font-semibold ${good ? 'text-[#0E7A55]' : 'text-[#B42318]'}`}>{p > 0 ? '▲' : '▼'} {Math.abs(p)}% vs mês anterior</span>;
}

const white = 'rounded-[18px] bg-[#FDFBF6] p-3.5 text-[#1E1B18]';

/** Fechamento: o mês que passou em cartas, no laranja do design. Padrão: o último mês fechado. */
export default async function FechamentoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const month = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : shiftMonth(currentMonth(), -1);
  const before = shiftMonth(month, -1);
  const [s, p, { transactions }, subs, progress] = await Promise.all([
    api<MonthSummaryResponse>(`/summary?month=${month}`),
    api<MonthSummaryResponse>(`/summary?month=${before}`),
    api<{ transactions: TransactionDTO[] }>(`/transactions?month=${month}`),
    api<SubscriptionsResponse>('/subscriptions').catch(() => null),
    api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
  ]);

  const sobrou = s.incomeInCents - s.outcomeInCents;
  const biggest = transactions.filter((t) => t.amountInCents < 0 && !t.isInternalTransfer).sort((a, b) => a.amountInCents - b.amountInCents)[0];
  const prevByCat = new Map(p.byCategory.map((c) => [c.categoryId, c.totalInCents]));
  const top = s.byCategory.filter((c) => c.categoryId).slice(0, 4);
  const lider = top[0];
  const share = lider && s.outcomeInCents ? Math.round((lider.totalInCents / s.outcomeInCents) * 100) : 0;
  const vezes = lider ? transactions.filter((t) => t.categoryId === lider.categoryId && t.amountInCents < 0).length : 0;
  const vazio = s.incomeInCents === 0 && s.outcomeInCents === 0;
  const nome = monthName(month);
  const isCurrent = month === currentMonth();
  const titulo = sobrou >= 0 ? (share >= 40 ? 'Mês no azul, com um porém' : 'Mês no azul') : 'Mês no vermelho, bora ajustar';
  const { xp } = xpFrom(progress.done.length, progress.bonusXp);
  const apostas = s.byCategory.find((c) => c.categoryId === 'apostas')?.totalInCents ?? 0;

  const resumo = (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <div className={`${white} flex flex-col gap-0.5`}><span className="text-xs font-semibold text-[#6B635A]">Entrou</span><span className="font-display text-[22px] font-extrabold tabular-nums">{money(s.incomeInCents)}</span><Delta now={s.incomeInCents} before={p.incomeInCents} goodWhenDown={false} /></div>
        <div className={`${white} flex flex-col gap-0.5`}><span className="text-xs font-semibold text-[#6B635A]">Saiu</span><span className="font-display text-[22px] font-extrabold tabular-nums">{money(s.outcomeInCents)}</span><Delta now={s.outcomeInCents} before={p.outcomeInCents} /></div>
      </div>
      {lider && (
        <div className="flex flex-col gap-1.5 rounded-[20px] bg-[#1E1B18] p-4 text-[#FDFBF6]">
          <span className="text-xs font-bold tracking-[0.08em] text-amarelo uppercase">O que mais comeu sua grana</span>
          <div className="flex items-baseline justify-between gap-2"><span className="font-display text-[28px] font-extrabold">{lider.name}</span><span className="font-display text-2xl font-extrabold tabular-nums">{money(lider.totalInCents)}</span></div>
          <span className="text-sm leading-5 text-[#E4DCCF]">{vezes} {vezes === 1 ? 'vez' : 'vezes'}, {share}% de tudo que saiu.{sobrou >= 0 && share >= 40 ? ' É o "porém" do título.' : ''}</span>
        </div>
      )}
      <div className={`${white} flex items-center gap-2 py-3 pl-1.5`}>
        <Mascote pose="tigrinho" size={72} alt="Tigrinho" />
        <div className="flex flex-col">
          <span className="text-[15px] font-bold">{apostas === 0 ? 'Vilão derrotado: Tigrinho' : `O Tigrinho levou ${money(apostas)}`}</span>
          <span className="text-[13px] leading-[18px] text-[#6B635A]">{apostas === 0 ? 'Nenhum centavo pra bet o mês inteiro.' : 'Aposta é feita pra casa ganhar. Bora zerar no mês que vem?'}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <div className="flex flex-col rounded-2xl bg-[#FFF1C7] px-1.5 py-2.5 text-[#1E1B18]"><span className="font-display text-2xl font-extrabold">{progress.streakDays}</span><span className="text-xs font-semibold">dias de ofensiva</span></div>
        <div className="flex flex-col rounded-2xl bg-[#DDF6E8] px-1.5 py-2.5 text-[#1E1B18]"><span className="font-display text-2xl font-extrabold">{progress.done.length}</span><span className="text-xs font-semibold">{progress.done.length === 1 ? 'lição feita' : 'lições feitas'}</span></div>
        <div className="flex flex-col rounded-2xl bg-[#DCEBFF] px-1.5 py-2.5 text-[#1E1B18]"><span className="font-display text-2xl font-extrabold">+{xp}</span><span className="text-xs font-semibold">de XP</span></div>
      </div>
    </>
  );

  const cartas: React.ReactNode[] = [resumo];
  cartas.push(
    <>
      <div className={`${white} flex flex-col gap-1 py-5`}>
        <span className="text-sm font-semibold text-[#6B635A]">{sobrou >= 0 ? 'Sobrou' : 'Faltou'} em {nome}</span>
        <span className={`font-display text-[44px] leading-none font-extrabold tabular-nums ${sobrou >= 0 ? 'text-[#0E7A55]' : 'text-[#B42318]'}`}>{money(Math.abs(sobrou))}</span>
        <span className="text-sm leading-5 text-[#6B635A]">{sobrou >= 0 ? 'Isso é o que entrou menos o que saiu. Dá pra mandar pra meta.' : 'Saiu mais do que entrou. Acontece: o importante é saber de onde.'}</span>
      </div>
      <Link href="/meta" className={`${white} flex items-center gap-2 py-3 pl-1.5 no-underline`}>
        <Mascote pose={sobrou >= 0 ? 'comemorando' : 'pensando'} size={64} alt="" />
        <span className="text-sm leading-5">{sobrou >= 0 ? <>Guardar uma parte agora conta na sua <b>meta</b>. Toca pra anotar.</> : <>Uma <b>meta</b> pequena ajuda a virar o jogo. Toca pra montar.</>}</span>
      </Link>
    </>,
  );
  if (top.length > 1) cartas.push(
    <div className={`${white} flex flex-col`}>
      <span className="mb-1 text-xs font-semibold tracking-[0.08em] text-[#6B635A] uppercase">Onde mais foi</span>
      {top.map((c) => (
        <div key={c.categoryId} className="flex items-center justify-between gap-3 border-b border-[#E4DCCF] py-2.5 last:border-b-0">
          <div className="flex flex-col"><span className="text-[15px] font-semibold">{c.name}</span><Delta now={c.totalInCents} before={prevByCat.get(c.categoryId) ?? 0} /></div>
          <span className="font-bold tabular-nums">{money(c.totalInCents)}</span>
        </div>
      ))}
    </div>,
  );
  if (biggest) cartas.push(
    <>
      <div className={`${white} flex flex-col gap-1 py-4`}>
        <span className="text-xs font-semibold tracking-[0.08em] text-[#6B635A] uppercase">Maior gasto do mês</span>
        <span className="font-display text-[34px] leading-none font-extrabold tabular-nums">{money(-biggest.amountInCents)}</span>
        <span className="font-semibold [overflow-wrap:anywhere]">{biggest.description}</span>
      </div>
      <Mascote pose="chocado" size={140} alt="Tostão chocado" className="self-center" />
    </>,
  );
  if (subs && subs.monthlyInCents > 0) cartas.push(
    <Link href="/assinaturas" className={`${white} flex flex-col items-center gap-2 py-6 text-center no-underline`}>
      <Mascote pose="investigando" size={110} alt="" />
      <span className="font-display text-[30px] leading-none font-extrabold tabular-nums">{money(subs.monthlyInCents)}</span>
      <span className="text-sm leading-5">por mês em assinaturas que cobram sozinhas. Toca pra ver quais.</span>
    </Link>,
  );

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-laranja text-[#1E1B18]">
      <Visita kind="visita:fechamento" />
      <div className="mx-auto flex min-h-full max-w-[520px] flex-col gap-3.5 px-5 pt-11 pb-7">
        {vazio ? (
          <>
        <div className="flex items-center justify-between">
          <img src="/wordmark.png" alt="Tostão" className="h-auto w-[92px]" />
          <Link href="/inicio" aria-label="Fechar" className="-mr-2.5 flex h-11 w-11 items-center justify-center text-[#1E1B18]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </Link>
        </div>

        <div className="-mb-2 flex items-center gap-1">
          <Link href={`/fechamento?mes=${before}`} aria-label="Mês anterior" className="-ml-2 flex h-9 w-9 items-center justify-center text-[#1E1B18]">‹</Link>
          <span className="text-sm font-bold">Seu {nome}{isCurrent ? ' até agora' : ''}{vazio ? ` ${month.slice(0, 4)}` : ` em ${cartas.length} cartas`}</span>
          {!isCurrent && <Link href={`/fechamento?mes=${shiftMonth(month, 1)}`} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center text-[#1E1B18]">›</Link>}
        </div>

            <div className={`${white} flex flex-col items-center gap-3 py-8 text-center`}>
              <Mascote pose="dormindo" size={150} alt="Tostão dormindo" />
              <p className="text-[15px] text-[#6B635A]">Não tenho nada de {nome}. Meu extrato começa depois disso.</p>
            </div>
            <div className="grow" />
            <Link href="/inicio" className="flex h-[52px] items-center justify-center rounded-full bg-[#1E1B18] text-[15px] font-bold text-[#FDFBF6] no-underline">Voltar pro início</Link>
          </>
        ) : (
          <>
            <Cartas
              cartas={cartas}
              share={<ShareButton text={`Fechei ${nome} no Tostão: ${titulo.toLowerCase()}. Grana explicada, de tostão em tostão.`} />}
              header={<>
        <div className="flex items-center justify-between">
          <img src="/wordmark.png" alt="Tostão" className="h-auto w-[92px]" />
          <Link href="/inicio" aria-label="Fechar" className="-mr-2.5 flex h-11 w-11 items-center justify-center text-[#1E1B18]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </Link>
        </div>

        <div className="-mb-2 flex items-center gap-1">
          <Link href={`/fechamento?mes=${before}`} aria-label="Mês anterior" className="-ml-2 flex h-9 w-9 items-center justify-center text-[#1E1B18]">‹</Link>
          <span className="text-sm font-bold">Seu {nome}{isCurrent ? ' até agora' : ''}{vazio ? ` ${month.slice(0, 4)}` : ` em ${cartas.length} cartas`}</span>
          {!isCurrent && <Link href={`/fechamento?mes=${shiftMonth(month, 1)}`} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center text-[#1E1B18]">›</Link>}
        </div>

                <h1 className="font-display text-[40px] leading-[42px] font-extrabold">{titulo}</h1>
              </>}
            />
          </>
        )}
      </div>
    </div>
  );
}

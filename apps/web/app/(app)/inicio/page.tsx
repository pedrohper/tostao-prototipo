import { CatIcon, Icone } from '@/components/icone';
import Link from 'next/link';
import type { BudgetsResponse, ForecastResponse, LessonProgressResponse, MonthSummaryResponse, ProfileResponse, SubscriptionsResponse } from '@tostao/contracts';
import { NO_PROGRESS } from '@/lib/xp';
import { BudgetBar } from '@/components/budget-bar';
import { api } from '@/lib/api';
import { ago, currentMonth, money, monthName, shiftMonth, shortDate } from '@/lib/format';
import { Mascote } from '@/components/mascote';
import { ButtonLink, Card, StreakChip } from '@/components/ui';

export default async function InicioPage() {
  const month = currentMonth();
  const [me, s, subs, limits, progress, forecast] = await Promise.all([
    api<ProfileResponse>('/me'),
    api<MonthSummaryResponse>(`/summary?month=${month}`),
    api<SubscriptionsResponse>('/subscriptions').catch(() => null),
    api<BudgetsResponse>(`/budgets?month=${month}`).catch(() => ({ budgets: [] })),
    api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
    api<ForecastResponse>('/forecast').catch(() => null),
  ]);
  const estourou = limits.budgets.find((b) => b.spentInCents > b.limitInCents);
  const activeSubs = subs?.subscriptions.filter((x) => x.active).length ?? 0;
  const firstName = me.name.split(' ')[0];
  const mes = monthName(month);
  const top = s.byCategory.filter((c) => c.categoryId);
  const max = Math.max(1, ...s.byCategory.map((c) => c.totalInCents));
  const delivery = s.byCategory.find((c) => c.categoryId === 'delivery');
  const bancos = s.accounts.filter((a) => a.type === 'BANK');
  const cartoes = s.accounts.filter((a) => a.type === 'CREDIT');
  // Nos primeiros 10 dias do mês, chama pro fechamento do mês que acabou
  const lastMonth = shiftMonth(month, -1);
  const showClosing = new Date(Date.now() - 3 * 3600_000).getUTCDate() <= 10;
  const broken = me.connections.filter((c) => c.status === 'ERROR' && !c.itemId.startsWith('import:'));
  const lastSync = me.connections.map((c) => c.lastSyncedAt).filter((x): x is string => !!x).sort().at(-1);
  const vazio = s.balanceInCents === null && s.outcomeInCents === 0 && s.incomeInCents === 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <h1 className="font-display text-[34px] leading-[38px] font-extrabold">Fala, {firstName}</h1>
        <div className="flex items-center gap-1.5">
          <Link href="/aprender" className="text-tinta no-underline"><StreakChip days={progress.streakDays} /></Link>
          <Link href="/perfil" aria-label="Abrir seu perfil" className="flex h-12 w-12 items-center justify-center rounded-full bg-rosa">
            <Mascote pose="avatar" size={38} alt="" />
          </Link>
        </div>
      </header>

      {broken.length > 0 && (
        <Link href="/conectar" role="alert" className="flex items-center gap-3 rounded-2xl bg-amarelo-claro p-3 no-underline">
          <Mascote pose="preocupado" size={56} alt="" />
          <p className="text-[15px]"><b>{broken.map((c) => c.displayName).join(', ')}</b> parou de atualizar. Os números podem estar atrasados. Toca pra resolver.</p>
        </Link>
      )}

      {vazio ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascote pose="dormindo" size={180} alt="Tostão dormindo" />
          <h2 className="font-display text-2xl font-extrabold">Nada por aqui ainda</h2>
          <p className="max-w-[300px] text-[15px] text-tinta-suave">Conecta o banco ou importa o extrato do app dele, que eu acordo e organizo seus gastos. Ou anota um gasto na mão, também vale.</p>
          <div className="mt-2 flex w-full flex-col gap-2.5">
            <ButtonLink href="/conectar" variant="laranja">Trazer meus gastos</ButtonLink>
            <ButtonLink href="/anotar" variant="outline">Anotar um gasto</ButtonLink>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3.5 rounded-[22px] border border-linha bg-cartao p-[18px]">
            {s.balanceInCents !== null ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-tinta-suave">Saldo em {bancos.length} {bancos.length === 1 ? 'conta' : 'contas'}</span>
                <span className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.5px] tabular-nums">{money(s.balanceInCents)}</span>
              </div>
            ) : (
              <span className="text-[13px] font-semibold text-tinta-suave">Sem banco conectado, contando só o que você anotou</span>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-0.5 rounded-[14px] bg-papel-2 px-3 py-2.5"><span className="text-xs font-semibold text-tinta-suave">Entrou em {mes}</span><span className="text-[17px] font-bold text-verde-texto tabular-nums">+ {money(s.incomeInCents)}</span></div>
              <div className="flex flex-col gap-0.5 rounded-[14px] bg-papel-2 px-3 py-2.5"><span className="text-xs font-semibold text-tinta-suave">Saiu em {mes}</span><span className="text-[17px] font-bold tabular-nums">{money(s.outcomeInCents)}</span></div>
            </div>
          </div>

          {s.uncategorizedCount > 0 && (
            <Link href="/carteira?filtro=pendentes" className="flex items-center gap-2 rounded-2xl bg-azul py-3 pr-3.5 pl-2 no-underline">
              <Mascote pose="caramelo-farejando" size={72} alt="Caramelo farejando" />
              <p className="text-[15px] leading-[21px]">O Caramelo farejou <b>{s.uncategorizedCount} {s.uncategorizedCount === 1 ? 'gasto sem categoria' : 'gastos sem categoria'}</b>. Toca aqui pra resolver.</p>
            </Link>
          )}

          {delivery && delivery.totalInCents >= 10000 ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rosa py-3.5 pr-3.5 pl-2">
              <Mascote pose="preocupado" size={92} alt="Tostão preocupado lendo um recibo" />
              <div className="flex min-w-0 flex-col gap-2.5">
                <p className="text-[15px] leading-[21px]">Eita, <b>{money(delivery.totalInCents)} em delivery</b> esse mês. Tem uma lição de 2 minutos sobre isso.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/aprender/m1-l2" className="flex h-9 items-center rounded-full bg-tinta px-4 text-sm font-semibold text-papel no-underline">Bora ver</Link>
                  <Link href="/chat" className="flex h-9 items-center rounded-full border-[1.5px] border-tinta px-4 text-sm font-semibold text-tinta no-underline">Pergunte ao Tostão</Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl bg-amarelo-claro py-3.5 pr-3.5 pl-2">
              <Mascote pose="pensando" size={84} alt="Tostão pensando" />
              <div className="flex min-w-0 flex-col gap-2.5">
                <p className="text-[15px] leading-[21px]">Ficou com dúvida sobre algum gasto ou quer saber se dá pra comprar algo? <b>Pergunta pra mim.</b></p>
                <Link href="/chat" className="flex h-9 items-center self-start rounded-full bg-tinta px-4 text-sm font-semibold text-papel no-underline">Pergunte ao Tostão</Link>
              </div>
            </div>
          )}

          {estourou && (
            <Link href="/limites" className="flex items-center gap-2 rounded-2xl bg-rosa p-3 no-underline">
              <Mascote pose="chocado" size={64} alt="Tostão chocado" />
              <p className="text-[15px] leading-[21px]"><b>{estourou.name} passou do limite</b>: {money(estourou.spentInCents)} de {money(estourou.limitInCents)}. Sem drama, mas segura até o fim do mês?</p>
            </Link>
          )}

          {showClosing && (
            <Link href="/fechamento" className="flex items-center gap-2 rounded-2xl bg-menta-clara p-3 no-underline">
              <Mascote pose="professor" size={64} alt="Tostão professor" />
              <p className="text-[15px] leading-[21px]"><b>O fechamento de {monthName(lastMonth)} tá pronto.</b> Quanto sobrou, onde mais foi e o que mudou. Toca pra ver.</p>
            </Link>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl leading-[26px] font-extrabold">Pra onde foi</h2>
              {lastSync && <span className="text-xs font-medium text-tinta-suave">atualizado {ago(lastSync)}</span>}
            </div>
            {top.length === 0 && <p className="text-sm text-tinta-suave">Nenhum gasto categorizado em {mes} ainda.</p>}
            <div className="flex flex-col gap-3">
              {top.slice(0, 5).map((c, i) => (
                <div key={c.categoryId} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[15px] font-semibold"><span>{c.name}</span><span className="tabular-nums">{money(c.totalInCents)}</span></div>
                  <div className="h-2.5 rounded-full bg-papel-2"><div className={`bar-fill h-full rounded-full ${i === 0 ? 'bg-laranja' : 'bg-tinta'}`} style={{ width: `${Math.max(2, (c.totalInCents / max) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          {forecast && (() => {
            const [prox, depois] = forecast.months;
            const chevron = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-tinta-suave"><path d="M9 18l6-6-6-6" /></svg>;
            if (!forecast.hasPlan || !prox) {
              return (
                <Link href="/renda" className="flex items-center gap-2 rounded-2xl bg-amarelo-claro py-3 pr-3.5 pl-1.5 text-tinta no-underline">
                  <Mascote pose="pensando" size={64} alt="Tostão pensando" />
                  <p className="grow text-[15px] leading-[21px]"><b>Quanto entra por mês?</b> Me conta sua renda e as contas fixas que eu prevejo os próximos meses.</p>
                  {chevron}
                </Link>
              );
            }
            const nome = (m: string) => monthName(m);
            return (
              <Link href="/previsao" className="flex items-center gap-3 rounded-2xl border border-linha bg-cartao p-3.5 text-tinta no-underline">
                <div className="flex grow flex-col gap-0.5">
                  <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Próximos meses</span>
                  <span className="text-[15px] leading-[21px]">
                    {nome(prox.month).charAt(0).toUpperCase() + nome(prox.month).slice(1)}: {prox.leftInCents >= 0 ? <>sobram uns <b>{money(prox.leftInCents)}</b>.</> : <>faltam uns <b>{money(-prox.leftInCents)}</b>.</>}
                    {depois && depois.leftInCents < Math.min(0, prox.leftInCents) ? ` ${nome(depois.month).charAt(0).toUpperCase() + nome(depois.month).slice(1)} aperta mais.` : ''}
                  </span>
                </div>
                {chevron}
              </Link>
            );
          })()}

          {forecast && (forecast.goal ? (() => {
            const g = forecast.goal;
            const pct = g.amountInCents ? Math.min(100, Math.round((g.savedInCents / g.amountInCents) * 100)) : 0;
            return (
              <Link href="/meta" className="flex flex-col gap-2 rounded-2xl border border-linha bg-cartao p-3.5 text-tinta no-underline">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Meta · {g.label}</span>
                  <span className="text-[13px] font-semibold tabular-nums">{pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-papel-2"><div className="bar-fill h-full rounded-full bg-menta" style={{ width: `${pct}%` }} /></div>
                <span className="text-[13px] text-tinta-suave">
                  {g.reached ? <span className="inline-flex items-center gap-1"><Icone src="ui/meta-batida" size={18} />Meta batida!</span> : `${money(g.savedInCents)}${g.amountInCents ? ` de ${money(g.amountInCents)}` : ''}${g.monthlyNeededInCents !== null ? ` · guardar ${money(g.monthlyNeededInCents)}/mês` : ''}`}
                </span>
              </Link>
            );
          })() : (
            <Link href="/meta" className="flex items-center gap-3 rounded-2xl border border-dashed border-linha p-3.5 text-[15px] text-tinta no-underline">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-menta-clara"><Icone src="meta/outro" size={26} /></span>
              <span className="grow"><b>Juntar pra alguma coisa?</b> Cria uma meta e eu te digo quanto guardar por mês.</span>
            </Link>
          ))}

          {cartoes.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl leading-[26px] font-extrabold">Cartões de crédito</h2>
                <Link href="/carteira" className="text-[13px] font-semibold text-laranja-texto">Ver todos</Link>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {cartoes.map((c, i) => {
                  const fatura = Math.max(0, -c.balanceInCents);
                  const uso = c.creditLimitInCents ? Math.min(100, (fatura / c.creditLimitInCents) * 100) : null;
                  return (
                    <Link key={c.id} href="/carteira" className="flex min-w-0 flex-col gap-1 rounded-2xl border border-linha bg-cartao p-3 text-tinta no-underline">
                      <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-tinta-suave"><Icone src="ui/cartao" size={18} /><span className="truncate">{c.name}</span></span>
                      <span className="text-[17px] font-bold tabular-nums">{money(fatura)}</span>
                      {uso !== null && (
                        <div className="h-1.5 rounded-full bg-papel-2" title={`${Math.round(uso)}% do limite`}>
                          <div className={`bar-fill h-full rounded-full ${i === 0 ? 'bg-laranja' : 'bg-tinta'}`} style={{ width: `${Math.max(2, uso)}%` }} />
                        </div>
                      )}
                      <span className="text-xs font-medium text-tinta-suave">{c.dueDate ? `Fatura vence ${shortDate(c.dueDate)}` : 'Fatura atual'}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {activeSubs > 0 && subs && (
            <Link href="/assinaturas" className="flex items-center gap-2 rounded-2xl bg-amarelo-claro p-3 no-underline">
              <Mascote pose="investigando" size={64} alt="Tostão investigando com uma lupa" />
              <p className="text-[15px] leading-[21px]"><b>{activeSubs} {activeSubs === 1 ? 'assinatura cobra' : 'assinaturas cobram'} todo mês</b>: {money(subs.monthlyInCents)}, ou {money(subs.yearlyInCents)} no ano. Toca pra ver quais são.</p>
            </Link>
          )}

          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">Limites</h2>
              <Link href="/limites" className="text-[13px] font-semibold text-laranja-texto">{limits.budgets.length ? 'Editar' : 'Definir'}</Link>
            </div>
            {limits.budgets.length === 0
              ? <p className="text-sm text-tinta-suave">Põe um teto em delivery, mercado ou no que pesar mais. Eu aviso quando chegar perto.</p>
              : limits.budgets.slice(0, 3).map((b) => <BudgetBar key={b.categoryId} budget={b} />)}
          </Card>
        </>
      )}
    </div>
  );
}

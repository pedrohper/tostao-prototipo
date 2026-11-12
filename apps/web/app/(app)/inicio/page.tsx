import Link from 'next/link';
import type { BudgetsResponse, MonthSummaryResponse, ProfileResponse, SubscriptionsResponse } from '@tostao/contracts';
import { BudgetBar } from '@/components/budget-bar';
import { api } from '@/lib/api';
import { currentMonth, money, monthName, shiftMonth } from '@/lib/format';
import { Mascote } from '@/components/mascote';
import { ButtonLink, Card } from '@/components/ui';

export default async function InicioPage() {
  const month = currentMonth();
  const [me, s, subs, limits] = await Promise.all([
    api<ProfileResponse>('/me'),
    api<MonthSummaryResponse>(`/summary?month=${month}`),
    api<SubscriptionsResponse>('/subscriptions').catch(() => null),
    api<BudgetsResponse>(`/budgets?month=${month}`).catch(() => ({ budgets: [] })),
  ]);
  const estourou = limits.budgets.find((b) => b.spentInCents > b.limitInCents);
  const activeSubs = subs?.subscriptions.filter((x) => x.active).length ?? 0;
  const firstName = me.name.split(' ')[0];
  const mes = monthName(month);
  const top = s.byCategory.filter((c) => c.categoryId);
  const max = Math.max(1, ...s.byCategory.map((c) => c.totalInCents));
  const delivery = s.byCategory.find((c) => c.categoryId === 'delivery');
  // Nos primeiros 10 dias do mês, chama pro fechamento do mês que acabou
  const lastMonth = shiftMonth(month, -1);
  const showClosing = new Date(Date.now() - 3 * 3600_000).getUTCDate() <= 10;
  const vazio = s.balanceInCents === null && s.outcomeInCents === 0 && s.incomeInCents === 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[28px] font-extrabold">Fala, {firstName}</h1>
        <Mascote pose="avatar" size={48} alt="" className="rounded-full bg-amarelo-claro" />
      </header>

      {vazio ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascote pose="dormindo" size={180} alt="Tostão dormindo" />
          <h2 className="font-display text-2xl font-extrabold">Nada por aqui ainda</h2>
          <p className="max-w-[300px] text-[15px] text-tinta-suave">Conecta um banco que eu acordo e organizo seus gastos sozinho. Ou anota um gasto na mão, também vale.</p>
          <div className="mt-2 flex w-full flex-col gap-2.5">
            <ButtonLink href="/conectar">Conectar meu banco</ButtonLink>
            <ButtonLink href="/anotar" variant="outline">Anotar um gasto</ButtonLink>
          </div>
        </Card>
      ) : (
        <>
          <div className="rounded-3xl bg-amarelo p-5 text-[#1E1B18]">
            {s.balanceInCents !== null ? (
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Saldo em {s.accounts.length} {s.accounts.length === 1 ? 'conta' : 'contas'}</span>
                <span className="font-display text-[40px] leading-tight font-extrabold">{money(s.balanceInCents)}</span>
              </div>
            ) : (
              <span className="text-sm font-semibold">Sem banco conectado, contando só o que você anotou</span>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="flex flex-col rounded-2xl bg-white/60 p-3"><span className="text-xs font-semibold">Entrou em {mes}</span><span className="text-[17px] font-bold">+ {money(s.incomeInCents)}</span></div>
              <div className="flex flex-col rounded-2xl bg-white/60 p-3"><span className="text-xs font-semibold">Saiu em {mes}</span><span className="text-[17px] font-bold">{money(s.outcomeInCents)}</span></div>
            </div>
          </div>

          {s.uncategorizedCount > 0 && (
            <Link href="/carteira?filtro=pendentes" className="flex items-center gap-3 rounded-[20px] bg-azul p-3 no-underline">
              <Mascote pose="caramelo-farejando" size={64} alt="Caramelo farejando" />
              <p className="text-[15px] leading-snug">O Caramelo farejou <b>{s.uncategorizedCount} {s.uncategorizedCount === 1 ? 'gasto sem categoria' : 'gastos sem categoria'}</b>. Toca aqui pra resolver.</p>
            </Link>
          )}

          {delivery && delivery.totalInCents >= 10000 && (
            <div className="flex items-center gap-3 rounded-[20px] bg-rosa p-3">
              <Mascote pose="preocupado" size={72} alt="Tostão preocupado lendo um recibo" />
              <div className="flex flex-col gap-2">
                <p className="text-[15px] leading-snug">Eita, <b>{money(delivery.totalInCents)} em delivery</b> esse mês. Tem uma lição de 2 minutos sobre isso.</p>
                <Link href="/aprender/m1-l2" className="self-start rounded-full bg-tinta px-4 py-2 text-sm font-semibold text-papel no-underline">Bora ver</Link>
              </div>
            </div>
          )}

          {estourou && (
            <Link href="/limites" className="flex items-center gap-3 rounded-[20px] bg-rosa p-3 no-underline">
              <Mascote pose="chocado" size={64} alt="Tostão chocado" />
              <p className="text-[15px] leading-snug"><b>{estourou.name} passou do limite</b>: {money(estourou.spentInCents)} de {money(estourou.limitInCents)}. Sem drama, mas segura até o fim do mês?</p>
            </Link>
          )}

          {showClosing && (
            <Link href="/fechamento" className="flex items-center gap-3 rounded-[20px] bg-menta-clara p-3 no-underline">
              <Mascote pose="professor" size={64} alt="Tostão professor" />
              <p className="text-[15px] leading-snug"><b>O fechamento de {monthName(lastMonth)} tá pronto.</b> Quanto sobrou, onde mais foi e o que mudou. Toca pra ver.</p>
            </Link>
          )}

          {activeSubs > 0 && subs && (
            <Link href="/assinaturas" className="flex items-center gap-3 rounded-[20px] bg-amarelo-claro p-3 no-underline">
              <Mascote pose="investigando" size={64} alt="Tostão investigando com uma lupa" />
              <p className="text-[15px] leading-snug"><b>{activeSubs} {activeSubs === 1 ? 'assinatura cobra' : 'assinaturas cobram'} todo mês</b>: {money(subs.monthlyInCents)}, ou {money(subs.yearlyInCents)} no ano. Toca pra ver quais são.</p>
            </Link>
          )}

          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">Limites</h2>
              <Link href="/limites" className="text-sm font-semibold text-laranja-texto">{limits.budgets.length ? 'Editar' : 'Definir'}</Link>
            </div>
            {limits.budgets.length === 0
              ? <p className="text-sm text-tinta-suave">Põe um teto em delivery, mercado ou no que pesar mais. Eu aviso quando chegar perto.</p>
              : limits.budgets.slice(0, 3).map((b) => <BudgetBar key={b.categoryId} budget={b} />)}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-xl font-extrabold">Pra onde foi</h2>
            {top.length === 0 && <p className="text-sm text-tinta-suave">Nenhum gasto categorizado em {mes} ainda.</p>}
            <div className="flex flex-col gap-3">
              {top.slice(0, 5).map((c) => (
                <div key={c.categoryId} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[15px]"><span className="font-semibold">{c.name}</span><span className="font-bold">{money(c.totalInCents)}</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-papel-2"><div className="h-full rounded-full bg-laranja" style={{ width: `${(c.totalInCents / max) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

import { Visita } from '@/components/visita';
import { CatIcon, Icone } from '@/components/icone';
import type { BudgetsResponse, CategoryDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth, money, monthName } from '@/lib/format';
import { Mascote } from '@/components/mascote';
import { BackLink, Card } from '@/components/ui';
import { BudgetBar } from '@/components/budget-bar';
import { BudgetForm } from './budget-form';

export default async function LimitesPage() {
  const month = currentMonth();
  const [{ budgets }, { categories }] = await Promise.all([
    api<BudgetsResponse>(`/budgets?month=${month}`),
    api<{ categories: CategoryDTO[] }>('/categories'),
  ]);
  const byCat = new Map(budgets.map((b) => [b.categoryId, b]));
  const spending = categories.filter((c) => c.kind === 'saida');

  return (
    <div className="flex flex-col gap-5">
      <Visita kind="visita:limites" />
      <BackLink href="/inicio" />
      <div className="flex items-center gap-3">
        <Mascote pose="professor" size={72} alt="Tostão professor" />
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold">Limites do mês</h1>
          <p className="text-[15px] text-tinta-suave">Um teto por categoria. Eu aviso quando chegar perto.</p>
        </div>
      </div>

      {budgets.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-extrabold capitalize">{monthName(month)} até agora</h2>
          {budgets.map((b) => <BudgetBar key={b.categoryId} budget={b} />)}
        </Card>
      )}

      <Card className="flex flex-col divide-y divide-linha p-0">
        {spending.map((c) => {
          const b = byCat.get(c.id);
          return (
            <div key={c.id} className="flex flex-col gap-2 p-4">
      <Visita kind="visita:limites" />
              <div className="flex justify-between text-[15px]">
                <span className="flex items-center gap-1.5 font-semibold"><CatIcon id={c.id} emoji={c.emoji} size={20} /> {c.name}</span>
                {b && <span className="text-tinta-suave">já foi {money(b.spentInCents)}</span>}
              </div>
              <BudgetForm categoryId={c.id} label={c.name} current={b?.limitInCents ?? null} />
            </div>
          );
        })}
      </Card>
      <p className="text-center text-[13px] text-tinta-suave">Deixa vazio pra tirar o limite. Dica: começa pela categoria que mais te incomoda, não por todas.</p>
    </div>
  );
}

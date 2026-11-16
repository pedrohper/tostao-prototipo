import { PageVisitTracker } from '@/components/visita';
import { CatIcon } from '@/components/icone';
import type { BudgetsResponse, CategoryDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth, money, monthName, resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink, Card, PageFrame } from '@/components/ui';
import { BudgetBar } from '@/components/budget-bar';
import { BudgetForm } from './budget-form';

export default async function LimitesPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const month = currentMonth();
  const [{ voltar }, { budgets }, { categories }, { locale, t }] = await Promise.all([
    searchParams,
    api<BudgetsResponse>(`/budgets?month=${month}`),
    api<{ categories: CategoryDTO[] }>('/categories'),
    getI18n(),
  ]);
  const p = t.pages.limites;
  const byCat = new Map(budgets.map((b) => [b.categoryId, b]));
  const spending = categories.filter((c) => c.kind === 'saida');
  const backHref = resolveBackHref(voltar, '/carteira?aba=planejar');

  return (
    <PageFrame size="analytics">
      <PageVisitTracker kind="visita:limites" />
      <BackLink href={backHref} label={t.common.back} />

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex items-center gap-3">
            <Mascot pose="professor" size={72} alt="Tostão" />
            <div>
              <h1 className="font-display text-[28px] leading-tight font-extrabold">{p.title}</h1>
              <p className="text-[15px] text-tinta-suave">{p.subtitle}</p>
            </div>
          </div>

          {budgets.length > 0 && (
            <Card className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-extrabold capitalize">{p.monthSoFar(monthName(month, locale))}</h2>
              {budgets.map((b) => <BudgetBar key={b.categoryId} budget={b} t={p.bar} />)}
            </Card>
          )}

          <p className="rounded-2xl bg-papel-2 px-4 py-3 text-[13px] leading-[19px] text-tinta-suave">
            {p.tip}
          </p>
        </div>

        <Card className="flex min-w-0 flex-col divide-y divide-linha p-0">
          {spending.map((c) => {
            const b = byCat.get(c.id);
            return (
              <div key={c.id} className="flex flex-col gap-2 p-4">
                <div className="flex justify-between gap-2 text-[15px]">
                  <span className="flex items-center gap-1.5 font-semibold"><CatIcon id={c.id} emoji={c.emoji} size={20} /> {c.name}</span>
                  {b && <span className="text-tinta-suave tabular-nums">{p.alreadySpent(money(b.spentInCents))}</span>}
                </div>
                <BudgetForm categoryId={c.id} label={c.name} current={b?.limitInCents ?? null} t={p.form} saveLabel={t.common.save} />
              </div>
            );
          })}
        </Card>
      </div>
    </PageFrame>
  );
}

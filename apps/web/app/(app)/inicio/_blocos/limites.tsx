// Limites por categoria (os 3 primeiros).
import Link from 'next/link';
import { BudgetBar } from '@/components/budget-bar';
import { getI18n } from '@/lib/i18n-server';
import { getBudgets } from './dados';

export async function LimitsSection({ month }: { month: string }) {
  const [{ t }, { budgets }] = await Promise.all([getI18n(), getBudgets(month)]);
  return (
    <Link
      href="/limites?voltar=/inicio"
      className="flex flex-col gap-3 rounded-[20px] border border-linha bg-cartao p-4 text-tinta no-underline"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold">{t.home.limitsTitle}</h2>
        <span className="text-small font-semibold text-laranja-texto">
          {budgets.length ? t.home.editAction : t.home.setAction}
        </span>
      </div>
      {budgets.length === 0 ? (
        <p className="text-sm text-tinta-suave">{t.home.emptyLimitsHint}</p>
      ) : (
        budgets.slice(0, 3).map((b) => <BudgetBar key={b.categoryId} budget={b} t={t.pages.limites.bar} />)
      )}
    </Link>
  );
}

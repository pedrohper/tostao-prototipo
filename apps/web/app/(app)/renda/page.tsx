import type { FinancialPlanResponse, IncomeSuggestionsResponse } from '@tostao/contracts';
import { PageFrame } from '@/components/ui';
import { api } from '@/lib/api';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { RendaForm } from './renda-form';
import { getMe } from '@/lib/api-queries';

export default async function RendaPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string; voltar?: string }>;
}) {
  const [{ novo, voltar }, { plan }, { suggestions }, me, { locale }] = await Promise.all([
    searchParams,
    api<FinancialPlanResponse>('/plan').catch(() => ({ plan: null })),
    api<IncomeSuggestionsResponse>('/plan/suggestions').catch(() => ({ suggestions: [] })),
    getMe(),
    getI18n(),
  ]);
  const banks = [...new Set(me.connections.map((c) => c.displayName))].filter((b) => !/importad/i.test(b));
  const backHref = resolveBackHref(voltar, '/carteira?aba=planejar');
  return (
    <PageFrame size="analytics">
      <RendaForm
        plan={plan}
        suggestions={suggestions}
        banks={banks}
        novo={!!novo}
        backHref={backHref}
        locale={locale}
      />
    </PageFrame>
  );
}

import type { FinancialPlanResponse, IncomeSuggestionsResponse, ProfileResponse } from '@tostao/contracts';
import { PageFrame } from '@/components/ui';
import { api } from '@/lib/api';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { RendaForm } from './renda-form';

export default async function RendaPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string; voltar?: string }>;
}) {
  const [{ novo, voltar }, { plan }, { suggestions }, me, { locale, t }] = await Promise.all([
    searchParams,
    api<FinancialPlanResponse>('/plan').catch(() => ({ plan: null })),
    api<IncomeSuggestionsResponse>('/plan/suggestions').catch(() => ({ suggestions: [] })),
    api<ProfileResponse>('/me'),
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
        t={t.pages.renda}
        backLabel={t.common.back}
        savingLabel={t.common.saving}
      />
    </PageFrame>
  );
}

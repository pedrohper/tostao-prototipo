import type { FinancialPlanResponse, IncomeSuggestionsResponse, ProfileResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { RendaForm } from './renda-form';

export default async function RendaPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const [{ novo }, { plan }, { suggestions }, me] = await Promise.all([
    searchParams,
    api<FinancialPlanResponse>('/plan').catch(() => ({ plan: null })),
    api<IncomeSuggestionsResponse>('/plan/suggestions').catch(() => ({ suggestions: [] })),
    api<ProfileResponse>('/me'),
  ]);
  const banks = [...new Set(me.connections.map((c) => c.displayName))].filter((b) => !/importad/i.test(b));
  return <RendaForm plan={plan} suggestions={suggestions} banks={banks} novo={!!novo} />;
}

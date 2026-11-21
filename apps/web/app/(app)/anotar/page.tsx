import type { CategoryDTO, TransactionDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth, resolveBackHref, shiftMonth, todayIso } from '@/lib/format';
import { recentDescriptions } from '@/lib/quick-add';
import { getI18n } from '@/lib/i18n-server';
import Link from 'next/link';
import { AnotarForm, type ContaOption } from './anotar-form';
import { getMe } from '@/lib/api-queries';

export default async function AnotarPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const month = currentMonth();
  const [{ voltar }, { categories }, me, { locale, t }, recentNow, recentBefore] = await Promise.all([
    searchParams,
    api<{ categories: CategoryDTO[] }>('/categories'),
    getMe().catch(() => null),
    getI18n(),
    // Só pra sugerir descrições: se falhar, o formulário funciona igual, sem sugestões.
    api<{ transactions: TransactionDTO[] }>(`/transactions?month=${month}`).catch(() => null),
    api<{ transactions: TransactionDTO[] }>(`/transactions?month=${shiftMonth(month, -1)}`).catch(() => null),
  ]);
  const recents = recentDescriptions([...(recentNow?.transactions ?? []), ...(recentBefore?.transactions ?? [])]);
  const a = t.pages.anotar;
  const backHref = resolveBackHref(voltar, '/carteira');
  // "Pago com" / "Recebido em": contas visíveis. As que vêm do banco atualizam sozinhas, então avisamos do risco de duplicar.
  const contas: ContaOption[] = (me?.connections ?? []).flatMap((c) =>
    c.accounts
      .filter((acc) => !acc.hidden)
      .map((acc) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        institution: c.institution,
        auto: !c.isImport,
      })),
  );
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-papel text-tinta md:items-center md:justify-center md:bg-papel-2/85 md:p-6 md:backdrop-blur-[2px]">
      <div className="flex min-h-0 w-full grow flex-col md:max-h-[90dvh] md:max-w-[560px] md:grow-0 md:overflow-hidden md:rounded-[26px] md:border md:border-linha md:bg-papel md:shadow-2xl">
        <div className="mx-auto flex w-full max-w-[520px] shrink-0 items-center justify-between px-3 pt-[max(12px,env(safe-area-inset-top))] pb-1 md:max-w-none md:px-5 md:pt-4">
          <Link
            href={backHref}
            aria-label={a.closeAria}
            className="flex h-11 w-11 items-center justify-center rounded-full text-tinta transition-colors hover:bg-papel-2"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
          <span className="text-[13px] font-semibold text-tinta-suave">{a.headerTitle}</span>
          <span className="w-11" aria-hidden="true" />
        </div>
        <AnotarForm
          categories={categories}
          contas={contas}
          today={todayIso()}
          recents={recents}
          back={backHref}
          locale={locale}
        />
      </div>
    </div>
  );
}

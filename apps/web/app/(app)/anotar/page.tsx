import type { CategoryDTO, ProfileResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import Link from 'next/link';
import { AnotarForm, type ContaOption } from './anotar-form';

export default async function AnotarPage() {
  const [{ categories }, me, { t }] = await Promise.all([
    api<{ categories: CategoryDTO[] }>('/categories'),
    api<ProfileResponse>('/me').catch(() => null),
    getI18n(),
  ]);
  const a = t.pages.anotar;
  // "Pago com" / "Recebido em": contas visíveis. As que vêm do banco atualizam sozinhas, então avisamos do risco de duplicar.
  const contas: ContaOption[] = (me?.connections ?? []).flatMap((c) =>
    c.accounts
      .filter((acc) => !acc.hidden)
      .map((acc) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        institution: c.institution,
        auto: !c.itemId.startsWith('import:'),
      })),
  );
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-papel text-tinta md:items-center md:justify-center md:bg-papel-2/85 md:p-6 md:backdrop-blur-[2px]">
      <div className="flex min-h-0 w-full grow flex-col md:max-h-[90dvh] md:max-w-[560px] md:grow-0 md:overflow-hidden md:rounded-[26px] md:border md:border-linha md:bg-papel md:shadow-2xl">
        <div className="mx-auto flex w-full max-w-[520px] shrink-0 items-center justify-between px-3 pt-[max(12px,env(safe-area-inset-top))] pb-1 md:max-w-none md:px-5 md:pt-4">
          <Link
            href="/carteira"
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
        <AnotarForm categories={categories} contas={contas} today={todayIso()} t={a} saveLabel={t.common.save} />
      </div>
    </div>
  );
}

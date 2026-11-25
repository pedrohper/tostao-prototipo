import Link from 'next/link';
import type { MonthSummaryResponse } from '@tostao/contracts';
import { BankBadge, CardNetworkBadge } from '@/components/banco';
import { getBankLogos } from '@/lib/api-queries';
import { Icon } from '@/components/icone';
import { BackLink, Eyebrow, PageFrame } from '@/components/ui';
import { api } from '@/lib/api';
import { currentMonth, money, resolveBackHref, updatedTimeLabel } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { AddAccountBox } from '../add-account';
import { HideAccountButton } from '../hide-account-button';
import { getMe } from '@/lib/api-queries';

export default async function EditarCarteiraPage({ searchParams }: { searchParams?: Promise<{ voltar?: string }> }) {
  const [{ locale, t }, sp, summary, profile, logos] = await Promise.all([
    getI18n(),
    searchParams ?? Promise.resolve<{ voltar?: string }>({}),
    api<MonthSummaryResponse>(`/summary?month=${currentMonth()}`),
    getMe().catch(() => null),
    getBankLogos(),
  ]);

  const tw = t.walletExtra.main;
  const backHref = resolveBackHref(sp.voltar, '/carteira?aba=contas');
  const title = locale === 'en' ? 'Edit my wallet' : locale === 'es' ? 'Editar mi cartera' : 'Editar minha carteira';
  const visibilityHeading =
    locale === 'en'
      ? 'Accounts & cards visibility'
      : locale === 'es'
        ? 'Visibilidad de cuentas y tarjetas'
        : 'Contas e cartões visíveis';
  const addOrConnectHeading =
    locale === 'en' ? 'Add or connect' : locale === 'es' ? 'Agregar o conectar' : 'Adicionar ou conectar';

  const connByAccountId = new Map<
    string,
    { displayName: string; lastSyncedAt: string | null; status: string; isImported: boolean; type: 'BANK' | 'CREDIT' }
  >();
  for (const conn of profile?.connections ?? []) {
    const isImported = conn.isImport;
    for (const acc of conn.accounts) {
      connByAccountId.set(acc.id, {
        displayName: conn.displayName,
        lastSyncedAt: conn.lastSyncedAt,
        status: conn.status,
        isImported,
        type: acc.type,
      });
    }
  }

  return (
    <PageFrame size="focused">
      <div className="flex items-center gap-1">
        <BackLink href={backHref} label={t.common.back} />
        <h1 className="truncate font-display text-[24px] leading-[30px] font-extrabold text-tinta">{title}</h1>
      </div>

      <section className="flex flex-col gap-3">
        <Eyebrow>{visibilityHeading}</Eyebrow>
        {summary.accounts.length > 0 && (
          <div className="flex flex-col divide-y divide-linha rounded-card border border-linha bg-cartao px-4">
            {summary.accounts.map((a) => {
              const conn = connByAccountId.get(a.id);
              const isCard = a.type === 'CREDIT';
              const syncText = conn
                ? conn.isImported
                  ? tw.importedStatement
                  : conn.status === 'ERROR'
                    ? tw.stoppedUpdating
                    : conn.lastSyncedAt
                      ? updatedTimeLabel(conn.lastSyncedAt, locale)
                      : tw.connectedStatus
                : tw.manualAccount;
              return (
                <div key={a.id} className="flex min-h-[68px] items-center gap-3 py-3">
                  <Link
                    href={`/carteira/conta/${a.id}?voltar=${encodeURIComponent('/carteira/editar')}`}
                    className="flex min-w-0 flex-1 items-center gap-3 text-tinta no-underline hover:text-laranja-texto"
                  >
                    <BankBadge nome={a.name} instituicao={conn?.displayName} size={36} quadrado logos={logos} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-body font-semibold">{a.name}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-tinta-suave">
                        {isCard && <CardNetworkBadge brand={a.brand} last4={a.last4} />}
                        {!isCard && <span>{syncText}</span>}
                      </span>
                    </div>
                  </Link>
                  <span className="shrink-0 text-body font-bold tabular-nums">
                    {money(isCard ? Math.max(0, -a.balanceInCents) : a.balanceInCents)}
                  </span>
                  <HideAccountButton accountId={a.id} hidden={false} t={t.walletExtra.hideAccount} />
                </div>
              );
            })}
          </div>
        )}

        {summary.hiddenAccounts.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            <Eyebrow>{tw.hiddenAccountsHeading}</Eyebrow>
            <div className="flex flex-col divide-y divide-linha rounded-card border border-linha bg-cartao px-4">
              {summary.hiddenAccounts.map((h) => {
                const conn = connByAccountId.get(h.id);
                const isCard = conn?.type === 'CREDIT';
                return (
                  <div key={h.id} className="flex min-h-[60px] items-center gap-3 py-2.5 text-tinta-suave">
                    <Link
                      href={`/carteira/conta/${h.id}?voltar=${encodeURIComponent('/carteira/editar')}`}
                      className="flex min-w-0 flex-1 items-center gap-3 text-tinta-suave no-underline hover:text-tinta"
                    >
                      <BankBadge nome={h.name} instituicao={conn?.displayName} size={30} logos={logos} />
                      <span className="truncate text-[14px] font-medium line-through">{h.name}</span>
                    </Link>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums">
                      {money(isCard ? Math.max(0, -h.balanceInCents) : h.balanceInCents)}
                    </span>
                    <HideAccountButton accountId={h.id} hidden={true} t={t.walletExtra.hideAccount} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <p className="text-xs leading-[18px] text-tinta-suave">{tw.hiddenAccountsHint}</p>
      </section>

      <section className="flex flex-col gap-3">
        <Eyebrow>{addOrConnectHeading}</Eyebrow>
        <AddAccountBox t={t.walletExtra.addAccount} cancelLabel={t.common.cancel} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/conectar?voltar=/carteira/editar"
            className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border border-linha bg-cartao px-4 py-3.5 text-tinta no-underline transition-colors hover:bg-papel-2"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-menta-clara text-tinta">
                <Icon src="conectar/banco" size={20} />
              </span>
              <span className="flex flex-col">
                <span className="text-[14px] font-bold">{tw.connectBankTitle}</span>
                <span className="text-xs text-tinta-suave">{tw.connectBankSub}</span>
              </span>
            </span>
            <span aria-hidden="true" className="text-tinta-suave">
              ›
            </span>
          </Link>
          <Link
            href="/importar?voltar=/carteira/editar"
            className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border border-linha bg-cartao px-4 py-3.5 text-tinta no-underline transition-colors hover:bg-papel-2"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-azul text-tinta">
                <Icon src="conectar/extrato" size={20} />
              </span>
              <span className="flex flex-col">
                <span className="text-[14px] font-bold">{tw.importStatementTitle}</span>
                <span className="text-xs text-tinta-suave">{tw.importStatementSub}</span>
              </span>
            </span>
            <span aria-hidden="true" className="text-tinta-suave">
              ›
            </span>
          </Link>
        </div>
      </section>
    </PageFrame>
  );
}

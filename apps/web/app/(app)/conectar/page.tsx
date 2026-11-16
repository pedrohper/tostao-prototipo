import { Icon } from '@/components/icone';
import Link from 'next/link';
import type { ConnectTokenResponse, ProfileResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Mascot } from '@/components/mascote';
import { BackLink, Card, Eyebrow, PageFrame } from '@/components/ui';
import { resolveBackHref, updatedTimeLabel } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { ConnectPanel, DisconnectButton, SyncButton } from './forms';

export default async function ConectarPage({ searchParams }: { searchParams: Promise<{ novo?: string; voltar?: string }> }) {
  const [{ novo, voltar }, me, mode, { locale, t }] = await Promise.all([
    searchParams,
    api<ProfileResponse>('/me'),
    // Só pra saber se a API fala com o Pluggy de verdade (token != null) ou com o banco de exemplo.
    // Se falhar (Pluggy fora do ar, trial vencido), a gente avisa e oferece importar extrato.
    api<ConnectTokenResponse>('/connections/connect-token', { method: 'POST', body: {} }).then((r) => ({ ...r, down: false })).catch(() => ({ connectToken: null, down: true })),
    getI18n(),
  ]);
  const p = t.pages.conectar;
  const widget = mode.connectToken !== null;
  const backHref = resolveBackHref(voltar, '/mais');
  const selfBack = novo ? '/conectar?novo=1' : voltar ? `/conectar?voltar=${encodeURIComponent(backHref)}` : '/conectar';
  const importarHref = `/importar?voltar=${encodeURIComponent(selfBack)}`;
  const caminhos = [
    { href: '#banco', icon: 'conectar/banco', bg: 'bg-menta-clara', t: p.paths.bank.title, tag: p.paths.bank.tag, d: p.paths.bank.desc },
    { href: '/importar', icon: 'conectar/extrato', bg: 'bg-azul', t: p.paths.import.title, tag: p.paths.import.tag, d: p.paths.import.desc },
    { href: '/anotar', icon: 'conectar/anotar', bg: 'bg-amarelo-claro', t: p.paths.manual.title, tag: null, d: p.paths.manual.desc },
  ] as const;
  const pontos = [
    { bg: 'bg-menta-clara', icon: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>, b: p.points[0].bold, t: p.points[0].text },
    { bg: 'bg-azul', icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />, b: p.points[1].bold, t: p.points[1].text },
    { bg: 'bg-amarelo-claro', icon: <><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><path d="M12 2v10" /></>, b: p.points[2].bold, t: p.points[2].text },
  ];

  return (
    <PageFrame size="analytics">
      {!novo && <BackLink href={backHref} label={t.common.back} />}
      {novo && (
        <div className="flex flex-col gap-1">
          <div className="h-2 overflow-hidden rounded-full border border-linha bg-papel-2" role="img" aria-label={p.stepAria}>
            <div className="h-full w-2/3 rounded-full bg-tinta" />
          </div>
          <span className="text-xs font-semibold text-tinta-suave">{p.stepBadge}</span>
        </div>
      )}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Mascot pose="conectando" size={96} alt={p.mascotAlt} />
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="font-display text-[26px] leading-[30px] font-extrabold lg:text-[32px] lg:leading-[36px]">
                {p.title}
              </h1>
              <p className="text-[14px] leading-[20px] text-tinta-suave">{p.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {caminhos.map((c) => (
              <Link
                key={c.href}
                href={c.href === '/importar' ? importarHref : c.href}
                className="flex items-center gap-3 rounded-2xl border border-linha bg-cartao p-3.5 text-tinta no-underline transition-colors hover:bg-papel-2"
              >
                <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.bg}`}>
                  <Icon src={c.icon} size={30} />
                </span>
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-bold">
                    {c.t}
                    {c.tag && <span className="rounded-full bg-amarelo-claro px-2 py-0.5 text-[11px] font-semibold text-tinta">{c.tag}</span>}
                  </span>
                  <span className="text-[13px] leading-[18px] text-tinta-suave">{c.d}</span>
                </span>
                <span className="shrink-0 text-tinta-suave" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3.5 rounded-[20px] border border-linha bg-cartao p-4">
            {pontos.map((pt) => (
              <div key={pt.b} className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${pt.bg}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {pt.icon}
                  </svg>
                </div>
                <p className="min-w-0 text-[15px] leading-[21px] text-tinta">
                  <b>{pt.b}</b> {pt.t}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div id="banco" className="flex scroll-mt-6 flex-col gap-4">
          <h2 className="pt-2 font-display text-xl font-extrabold lg:pt-0 lg:text-2xl">{p.sectionTitle}</h2>

          {mode.down && (
            <div role="alert" className="flex items-center gap-3 rounded-[20px] bg-amarelo-claro p-3.5">
              <Mascot pose="preocupado" size={64} alt="" />
              <p className="min-w-0 text-[15px] leading-[21px] text-tinta">
                {p.downAlertBefore}
                <Link href={importarHref} className="font-semibold underline">
                  {p.downAlertLink}
                </Link>
                {p.downAlertAfter}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2.5 rounded-[20px] border border-linha bg-papel-2 p-4">
            {mode.down ? (
              <>
                <h3 className="font-display text-lg font-extrabold">{p.downBoxTitle}</h3>
                <p className="text-[14px] leading-relaxed text-tinta-suave">
                  {p.downBoxBody}
                </p>
              </>
            ) : widget ? (
              <>
                <Eyebrow>{p.howTitle}</Eyebrow>
                <ol className="list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-tinta">
                  <li>{p.howSteps[0]}</li>
                  <li>
                    {p.howSteps[1]}<b>MeuPluggy</b>{p.howSteps[2]}
                    <a href="https://meu.pluggy.ai" target="_blank" rel="noreferrer" className="font-semibold underline">
                      meu.pluggy.ai
                    </a>
                    {p.howSteps[3] ? '' : ''}
                  </li>
                  <li>{p.howSteps[3]}</li>
                </ol>
              </>
            ) : (
              <>
                <h3 className="font-display text-lg font-extrabold">{p.fakeTitle}</h3>
                <p className="text-[14px] leading-relaxed text-tinta-suave">
                  {p.fakeBodyBefore}<code>BANK_GATEWAY=fake</code>{p.fakeBodyAfter}
                </p>
              </>
            )}
          </div>

          {!mode.down && <ConnectPanel widget={widget} novo={Boolean(novo)} locale={locale} t={p.panel} />}

          {me.connections.length > 0 && (
            <section className="flex flex-col gap-2.5 pt-1">
              <Eyebrow>{p.connectedBanks}</Eyebrow>
              {me.connections.map((c) => {
                const imported = c.itemId.startsWith('import:');
                return (
                  <Card key={c.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold text-tinta">{c.displayName}</span>
                      <span
                        className={`shrink-0 text-xs font-bold ${
                          imported ? 'text-tinta-suave' : c.status === 'ACTIVE' ? 'text-verde-texto' : 'text-vermelho-texto'
                        }`}
                      >
                        {imported ? p.importedTag : c.status === 'ACTIVE' ? p.activeTag : p.errorTag}
                      </span>
                    </div>
                    <span className="text-xs text-tinta-suave">
                      {c.lastSyncedAt
                        ? imported
                          ? `${p.lastFile} · ${updatedTimeLabel(c.lastSyncedAt, locale)}`
                          : updatedTimeLabel(c.lastSyncedAt, locale)
                        : `${imported ? p.lastFile : p.lastSync}: ${p.never}`}
                    </span>
                    {!imported && c.status === 'ERROR' && (
                      <p className="text-[13px] text-vermelho-texto">
                        {p.errorHelp}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {imported ? (
                        <Link href={`/importar?conta=${encodeURIComponent(c.institution ?? '')}&voltar=${encodeURIComponent(selfBack)}`} className="text-sm font-semibold underline">
                          {p.importMore}
                        </Link>
                      ) : (
                        <SyncButton id={c.id} t={p.panel} />
                      )}
                      <DisconnectButton id={c.id} name={c.displayName} t={p.panel} />
                    </div>
                  </Card>
                );
              })}
            </section>
          )}

          {novo && (
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/renda?novo=1" className="flex h-[54px] items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel no-underline">
                {p.continueOnboarding}
              </Link>
              <Link href="/inicio" className="flex h-11 items-center justify-center text-sm font-semibold text-tinta-suave no-underline">
                {p.skipOnboarding}
              </Link>
            </div>
          )}
        </div>
      </div>
    </PageFrame>
  );
}

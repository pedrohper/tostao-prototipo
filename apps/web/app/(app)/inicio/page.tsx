// Início (T6.9): a página só espera o essencial (resumo do mês e perfil) e desenha o saldo. O resto é um bloco por
// arquivo em `_blocos/`, cada um buscando o próprio dado dentro de <Suspense> e chegando por streaming.
import { Fragment, Suspense } from 'react';
import { AskTostaoCard } from './ask-card';
import { DesktopBalanceRow, MobileBalanceCard } from './balance-card';
import { PendingAlertsCard } from './pending-alerts-card';
import { PlanejarAtalhos } from './planejar-atalhos';
import { SplitsSection } from './_blocos/acertos';
import { LessonCard, LessonRailCard } from './_blocos/aula';
import { DesktopHighlightAlert, DesktopSideAlerts, LocalAlerts, TostaoFindings } from './_blocos/avisos';
import { Block } from './_blocos/bloco';
import { MonthSelector } from './_blocos/cabecalho';
import { CreditCardsSection } from './_blocos/cartoes';
import { getHomeAuto, getHomeMissions, getHomeProgress, getSummary, prefetchSections } from './_blocos/dados';
import { EmptyHome, isEmptyHome } from './_blocos/estado-vazio';
import { EvolutionSection } from './_blocos/evolucao';
import { LimitsSection } from './_blocos/limites';
import { DesktopSpendingCard, SpendingSection } from './_blocos/pra-onde-foi';
import { GoalsSection, LeftoverSection } from './_blocos/previsao';
import { CustomizeHomeLink, RestoreAlertsForm } from './_blocos/rodape';
import { balanceCardProps } from './_blocos/saldo';
import { RemindersSection, WeekSection } from './_blocos/semana';
import { DesktopSplitShell } from '@/components/lateral';
import { Mascot } from '@/components/mascote';
import { PwaInstallBanner } from '@/components/pwa-install-banner';
import { QuickAddButton } from '@/components/quick-add-sheet';
import { MissionCompletionToast } from '@/components/sons';
import { StreakModalButton } from '@/components/streak-modal';
import { Await, SectionSkeleton, startEarly } from '@/components/suspense';
import { SyncHomePrefs } from '@/components/sync-home-prefs';
import { getMe } from '@/lib/api-queries';
import { currentMonth, todayIso } from '@/lib/format';
import { MAX_HOME_ALERTS } from '@/lib/home-alerts';
import { getI18n } from '@/lib/i18n-server';
import { resolveSectionOrder, type HomeSectionId } from '@/lib/inicio-prefs';
import { readHomePrefsState } from '@/lib/inicio-prefs-server';
import Link from 'next/link';

const DESKTOP_LEFT_EXTRAS = new Set<HomeSectionId>(['evolucao', 'sobra', 'cartoes', 'limites', 'acertos', 'vence']);
/** Altura do quadro de achados por quantidade de cartões (celular / computador), medida nos prints. */
const FINDINGS_SKELETON = [undefined, 'h-[215px] lg:h-[200px]', 'h-[390px] lg:h-[355px]'];

export default async function HomePage({ searchParams }: { searchParams?: Promise<{ mes?: string }> }) {
  const sp = await (searchParams ?? Promise.resolve<{ mes?: string }>({}));
  const hoje = currentMonth();
  const rawMes = sp.mes;
  const month = /^\d{4}-\d{2}$/.test(rawMes ?? '') && rawMes! <= hoje ? rawMes! : hoje;
  // O saldo não depende das preferências: o pedido dele sai junto, sem fila.
  const summaryP = startEarly(getSummary(month));
  const profileP = startEarly(getMe());
  const [{ prefs, needsSync }, { locale, t }] = await Promise.all([readHomePrefsState(), getI18n()]);
  const isSectionVisible = (id: HomeSectionId) => !prefs.ocultos.includes(id);
  const visibleSections = resolveSectionOrder(prefs).filter(isSectionVisible);

  // Os pedidos dos blocos começam já; a página só espera o que desenha o topo.
  const missionsP = startEarly(getHomeMissions());
  const progressP = startEarly(getHomeProgress());
  prefetchSections(visibleSections, month);
  // `auto` o layout já pede: aqui serve pra reservar o tamanho certo do quadro de achados.
  const [summary, profile, auto] = await Promise.all([summaryP, profileP, getHomeAuto()]);

  const isEmptyState = isEmptyHome(summary);
  const brokenConnections = profile.connections.filter((c) => c.status === 'ERROR' && !c.isImport);
  const balanceProps = balanceCardProps({ summary, month, isPastMonth: month < hoje, locale, t });

  const sections: Record<HomeSectionId, React.ReactNode> = {
    atalhos: <PlanejarAtalhos t={t} />,
    pendencias: (
      <PendingAlertsCard
        month={month}
        title={t.growth.home.pendingAlertsTitle}
        pendingExpensesLabel={t.growth.home.pendingExpensesLabel}
        pendingIncomesLabel={t.growth.home.pendingIncomesLabel}
        pendingExpensesCount={summary.pendingExpensesCount ?? 0}
        pendingExpensesInCents={summary.pendingExpensesInCents ?? 0}
        pendingIncomesCount={summary.pendingIncomesCount ?? 0}
        pendingIncomesInCents={summary.pendingIncomesInCents ?? 0}
      />
    ),
    aula: (
      <Block skeleton="h-[112px]">
        <LessonCard />
      </Block>
    ),
    sobra: (
      <Block skeleton="h-[113px]">
        <LeftoverSection />
      </Block>
    ),
    vence: (
      <Block skeleton="h-[255px]">
        <RemindersSection />
      </Block>
    ),
    avisos: (
      <Block>
        <LocalAlerts month={month} />
      </Block>
    ),
    evolucao: (
      <Block skeleton="h-[315px]">
        <EvolutionSection month={month} />
      </Block>
    ),
    'pra-onde-foi': <SpendingSection summary={summary} profile={profile} month={month} locale={locale} t={t} />,
    semana: (
      <Block skeleton="h-[155px]">
        <WeekSection />
      </Block>
    ),
    meta: (
      <Block skeleton="h-[125px]">
        <GoalsSection />
      </Block>
    ),
    acertos: (
      <Block skeleton="h-[100px]">
        <SplitsSection />
      </Block>
    ),
    cartoes: summary.accounts.some((a) => a.type === 'CREDIT') ? (
      <Block skeleton="h-[146px]">
        <CreditCardsSection summary={summary} profile={profile} />
      </Block>
    ) : null,
    limites: (
      <Block skeleton="h-[290px]">
        <LimitsSection month={month} />
      </Block>
    ),
  };

  // Coluna da direita no computador: só o que a pessoa deixou ligado (jogos e amigos moram em /mais).
  const showLesson = isSectionVisible('aula');
  const showGoal = isSectionVisible('meta');
  const rightRail = (
    <>
      {showLesson && (
        <>
          <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
            {t.nav.learnHeader}
          </span>
          <Block skeleton="h-[288px]">
            <LessonRailCard />
          </Block>
        </>
      )}
      {showGoal && (
        <Block skeleton="h-[125px]">
          <GoalsSection rail />
        </Block>
      )}
    </>
  );

  const footerLinks = (
    <>
      <RestoreAlertsForm count={prefs.fechados.length} t={t} />
      <CustomizeHomeLink t={t} />
    </>
  );
  const monthSelector = <MonthSelector month={month} currentMonth={hoje} locale={locale} t={t} />;

  const content = (
    <>
      <Suspense fallback={null}>
        <Await promise={missionsP}>
          {(missions) =>
            missions && (
              <MissionCompletionToast
                day={todayIso()}
                done={missions.missions.filter((m) => m.done).length}
                streak={missions.streakDays}
                locale={locale}
              />
            )
          }
        </Await>
      </Suspense>

      {needsSync && <SyncHomePrefs />}

      {/*
        Uma árvore só pro que é igual nos dois tamanhos (cabeçalho, alertas, estado vazio, achados do Tostão): esses
        componentes têm estado e efeitos, então não podem montar duas vezes. O que muda de verdade (cartão de saldo e
        corpo da página) fica em dois blocos exibidos por CSS (`lg:`).
      */}
      <div className="flex flex-col gap-6 lg:gap-7">
        <header className="flex items-center justify-between gap-2 lg:gap-4">
          {monthSelector}
          <div className="flex shrink-0 items-center gap-2">
            <Suspense fallback={<SectionSkeleton height="h-10 w-16" />}>
              <Await promise={Promise.all([missionsP, progressP])}>
                {([missions, progress]) => (
                  <StreakModalButton
                    days={missions?.streakDays ?? progress.streakDays}
                    missions={missions}
                    locale={locale}
                    label={t.nav.streakDays(missions?.streakDays ?? progress.streakDays)}
                  />
                )}
              </Await>
            </Suspense>
          </div>
        </header>

        {brokenConnections.length > 0 && (
          <Link
            href="/conectar"
            role="alert"
            className="flex items-center gap-3 rounded-2xl bg-amarelo-claro p-3 text-tinta no-underline"
          >
            <Mascot pose="preocupado" size={56} alt="" />
            <p className="text-[15px]">
              {t.home.connectionBroken(brokenConnections.map((c) => c.displayName).join(', '))}
            </p>
          </Link>
        )}

        <PwaInstallBanner locale={locale} />

        {isEmptyState ? (
          <Block skeleton="h-[620px]">
            <EmptyHome profile={profile} />
          </Block>
        ) : (
          <>
            {/* T6.17 · "Quanto posso gastar hoje" entra aqui, acima do saldo (um lugar só pro celular e o computador). */}
            <div className="flex flex-col gap-3 lg:hidden">
              <MobileBalanceCard {...balanceProps} />
            </div>
            {/* Mobile: anotar vira botão flutuante (a aba Tostão da barra de baixo já cobre o "perguntar pro Tostão"). */}
            <QuickAddButton variant="fab" label={t.nav.addExpense} locale={locale} />
            <div className="hidden lg:block">
              <DesktopBalanceRow {...balanceProps} />
            </div>

            {/* Um quadro só (e no máximo 2 achados): o que ele já diz não se repete nos avisos abaixo. */}
            {isSectionVisible('avisos') && (
              <Block skeleton={FINDINGS_SKELETON[Math.min(auto?.insights.length ?? 0, MAX_HOME_ALERTS)]}>
                <TostaoFindings month={month} />
              </Block>
            )}

            {/* Mobile & Tablet (< lg) */}
            <div className="flex min-w-0 flex-col gap-6 pb-16 lg:hidden">
              {visibleSections.map((id) => (
                <Fragment key={id}>{sections[id]}</Fragment>
              ))}
              {footerLinks}
            </div>

            {/* Desktop (lg+) */}
            <div className="hidden lg:flex lg:flex-col lg:gap-7">
              {isSectionVisible('atalhos') && sections.atalhos}
              {isSectionVisible('pendencias') && sections.pendencias}

              <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-[18px]">
                  {isSectionVisible('pra-onde-foi') && (
                    <DesktopSpendingCard summary={summary} month={month} locale={locale} t={t} />
                  )}
                  {visibleSections
                    .filter((id) => DESKTOP_LEFT_EXTRAS.has(id))
                    .map((id) => (
                      <Fragment key={id}>{sections[id]}</Fragment>
                    ))}
                </div>

                <div className="flex min-w-0 flex-col gap-[18px]">
                  {isSectionVisible('avisos') && (
                    <Block>
                      <DesktopHighlightAlert month={month} />
                    </Block>
                  )}
                  <AskTostaoCard locale={locale} />
                  {isSectionVisible('semana') && sections.semana}
                  {isSectionVisible('avisos') && (
                    <Block>
                      <DesktopSideAlerts month={month} hideUncategorized={isSectionVisible('pra-onde-foi')} />
                    </Block>
                  )}
                  <div className="flex flex-col items-center gap-2 pt-1">{footerLinks}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  return showLesson || showGoal ? (
    <DesktopSplitShell rightWidth={320} right={rightRail}>
      {content}
    </DesktopSplitShell>
  ) : (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">{content}</div>
  );
}

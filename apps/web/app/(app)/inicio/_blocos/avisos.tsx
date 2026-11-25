// Avisos da Home: o quadro de achados do Tostão e os avisos calculados aqui (limite, sem categoria, delivery,
// fechamento, assinaturas). `unifyAlerts` mostra no máximo 2, sem repetir o que o quadro já diz.
import { Fragment, cache } from 'react';
import Link from 'next/link';
import type { TostaoInsightDTO } from '@tostao/contracts';
import { DismissibleCard } from '@/components/fechavel';
import { Mascot } from '@/components/mascote';
import { TostaoFindingsBoard } from '@/components/tostao-auto-card';
import { currentDayOfMonth, money, monthName, shiftMonth } from '@/lib/format';
import { unifyAlerts, type LocalAlertKey } from '@/lib/home-alerts';
import { getI18n } from '@/lib/i18n-server';
import { readHomePrefs } from '@/lib/inicio-prefs-server';
import { getBudgets, getHomeAuto, getSubscriptions, getSummary } from './dados';

const DELIVERY_TIP_FROM_CENTS = 10000;

/** Calculado uma vez por render e usado pelos quatro pedaços abaixo (celular e computador). */
const getAlerts = cache(async (month: string) => {
  const [{ locale, t }, prefs, summary, budgetsData, subscriptions, auto] = await Promise.all([
    getI18n(),
    readHomePrefs(),
    getSummary(month),
    getBudgets(month),
    getSubscriptions(),
    getHomeAuto(),
  ]);
  const isOpen = (key: string) => !prefs.fechados.includes(key);
  const overBudget = budgetsData.budgets.find((b) => b.spentInCents > b.limitInCents);
  const delivery = summary.byCategory.find((c) => c.categoryId === 'delivery');
  const bigDelivery = delivery && delivery.totalInCents >= DELIVERY_TIP_FROM_CENTS ? delivery : null;
  const subscriptionCount = subscriptions?.subscriptions.filter((sub) => sub.active).length ?? 0;
  const previousMonth = shiftMonth(month, -1);
  const tipKey = `dica:${month}:${bigDelivery ? 'delivery' : 'chat'}`;

  const uncategorizedKey = `pendentes:${month}:${summary.uncategorizedCount}`;
  const uncategorized =
    summary.uncategorizedCount > 0 && isOpen(uncategorizedKey) ? (
      <DismissibleCard id={uncategorizedKey} label={t.home.dismissAlertLabel}>
        <Link
          href="/carteira?filtro=pendentes"
          className="flex items-center gap-2 rounded-2xl bg-azul py-3 pr-10 pl-2 text-tinta no-underline"
        >
          <Mascot pose="caramelo-farejando" size={72} alt="Caramelo" />
          <p className="text-[15px] leading-[21px]">
            {locale === 'pt-BR' ? 'O Caramelo:' : 'Caramelo:'}{' '}
            <b>{t.home.uncategorizedAlert(summary.uncategorizedCount)}</b>.
          </p>
        </Link>
      </DismissibleCard>
    ) : null;

  const monthlyClosing =
    currentDayOfMonth() <= 10 && isOpen(`fechamento:${previousMonth}`) ? (
      <DismissibleCard id={`fechamento:${previousMonth}`} label={t.home.dismissAlertLabel}>
        <Link
          href="/fechamento?voltar=/inicio"
          className="flex items-center gap-2 rounded-2xl bg-menta-clara p-3 pr-10 text-tinta no-underline"
        >
          <Mascot pose="professor" size={64} alt="Tostão" />
          <p className="text-[15px] leading-[21px]">
            <b>{t.home.monthlyClosingReady(monthName(previousMonth, locale))}</b> {t.home.monthlyClosingSub}
          </p>
        </Link>
      </DismissibleCard>
    ) : null;

  const subscriptionsKey = `assinaturas:${subscriptionCount}:${subscriptions?.monthlyInCents}`;
  const subscriptionsAlert =
    subscriptionCount > 0 && subscriptions && isOpen(subscriptionsKey) ? (
      <DismissibleCard id={subscriptionsKey} label={t.home.dismissAlertLabel}>
        <Link
          href="/assinaturas?voltar=/inicio"
          className="flex items-center gap-2 rounded-2xl bg-amarelo-claro p-3 pr-10 text-tinta no-underline"
        >
          <Mascot pose="investigando" size={64} alt="Tostão" />
          <p className="text-[15px] leading-[21px]">
            {t.home.activeSubscriptionsAlert(
              subscriptionCount,
              money(subscriptions.monthlyInCents),
              money(subscriptions.yearlyInCents),
            )}
          </p>
        </Link>
      </DismissibleCard>
    ) : null;

  const deliveryTip =
    bigDelivery && isOpen(tipKey) ? (
      <DismissibleCard id={tipKey} label={t.home.dismissAlertLabel}>
        <div className="relative flex items-center gap-2 rounded-2xl bg-rosa py-3.5 pr-10 pl-2 text-tinta">
          <Link href="/aprender/m1-l2" aria-label={t.home.viewLessonCta} className="absolute inset-0 rounded-2xl" />
          <Mascot pose="preocupado" size={92} alt="Tostão" />
          <div className="flex min-w-0 flex-col gap-2.5">
            <p className="text-[15px] leading-[21px]">
              <b>{t.home.deliveryAlert(money(bigDelivery.totalInCents))}</b>.
            </p>
            <div className="relative z-[1] flex flex-wrap gap-2">
              <Link
                href="/aprender/m1-l2"
                className="flex h-9 items-center rounded-full bg-tinta px-4 text-sm font-semibold text-papel no-underline"
              >
                {t.home.viewLessonCta}
              </Link>
              <Link
                href="/tostao"
                className="flex h-9 items-center rounded-full border-[1.5px] border-tinta px-4 text-sm font-semibold text-tinta no-underline"
              >
                {t.home.askTostao}
              </Link>
            </div>
          </div>
        </div>
      </DismissibleCard>
    ) : null;

  const overBudgetKey = overBudget ? `estourou:${overBudget.categoryId}:${month}` : '';
  const overBudgetAlert =
    overBudget && isOpen(overBudgetKey) ? (
      <DismissibleCard id={overBudgetKey} label={t.home.dismissAlertLabel}>
        <Link
          href="/limites?voltar=/inicio"
          className="flex items-center gap-2 rounded-2xl bg-rosa p-3 pr-10 text-tinta no-underline"
        >
          <Mascot pose="chocado" size={64} alt="Tostão" />
          <p className="text-[15px] leading-[21px]">
            <b>
              {t.home.overBudgetAlert(overBudget.name, money(overBudget.spentInCents), money(overBudget.limitInCents))}
            </b>
          </p>
        </Link>
      </DismissibleCard>
    ) : null;

  const nodes: Record<LocalAlertKey, React.ReactNode> = {
    overBudget: overBudgetAlert,
    uncategorized,
    deliveryTip,
    monthlyClosing,
    subscriptions: subscriptionsAlert,
  };
  const present = (Object.keys(nodes) as LocalAlertKey[]).filter((k) => Boolean(nodes[k]));
  const unified = unifyAlerts<TostaoInsightDTO>({ insights: auto?.insights ?? [], local: present });
  return { locale, t, auto, unified, nodes, overBudget, bigDelivery };
});

/** Um quadro só (e no máximo 2 achados): o que ele já diz não se repete nos avisos abaixo. */
export async function TostaoFindings({ month }: { month: string }) {
  const { auto, unified, locale } = await getAlerts(month);
  if (!auto || unified.insights.length === 0) return null;
  return (
    <TostaoFindingsBoard
      initial={{ ...auto, insights: unified.insights }}
      locale={locale}
      compact
      seeAllHref="/tostao?aba=automatico"
    />
  );
}

/** Celular: os avisos na posição que a pessoa escolheu pra eles. */
export async function LocalAlerts({ month }: { month: string }) {
  const { unified, nodes } = await getAlerts(month);
  return unified.local.map((key) => <Fragment key={key}>{nodes[key]}</Fragment>);
}

/** Computador: o cartão grande no topo da coluna da direita (delivery ou limite estourado). */
export async function DesktopHighlightAlert({ month }: { month: string }) {
  const { unified, t, overBudget, bigDelivery } = await getAlerts(month);
  if (!unified.local.includes('deliveryTip') && !unified.local.includes('overBudget')) return null;
  const content = bigDelivery
    ? {
        pose: 'preocupado' as const,
        text: (
          <>
            <b>{t.home.deliveryAlert(money(bigDelivery.totalInCents))}</b>. {t.nav.learnPrompt}
          </>
        ),
        href: '/aprender/m1-l2',
        cta: t.home.viewLessonCta,
      }
    : overBudget
      ? {
          pose: 'chocado' as const,
          text: (
            <b>
              {t.home.overBudgetAlert(overBudget.name, money(overBudget.spentInCents), money(overBudget.limitInCents))}
            </b>
          ),
          href: '/limites?voltar=/inicio',
          cta: t.home.limitsTitle,
        }
      : {
          pose: 'pensando' as const,
          text: (
            <>
              {t.home.chatPromptBody} <b>{t.home.chatPromptBold}</b>
            </>
          ),
          href: '/tostao',
          cta: t.home.askTostao,
        };
  return (
    <div className="flex items-center gap-2.5 rounded-[22px] bg-rosa p-[18px_20px_18px_10px] text-tinta">
      <Mascot pose={content.pose} size={110} alt="Tostão" />
      <div className="flex min-w-0 flex-col gap-3">
        <p className="m-0 text-base leading-[23px]">{content.text}</p>
        <Link
          href={content.href}
          className="flex h-10 items-center self-start rounded-full bg-tinta px-[18px] text-sm font-semibold text-papel no-underline"
        >
          {content.cta}
        </Link>
      </div>
    </div>
  );
}

/**
 * Computador: os outros avisos. Delivery e limite estourado já estão no cartão do topo; "sem categoria" já aparece no
 * "Pra onde foi" quando ele está na tela.
 */
export async function DesktopSideAlerts({ month, hideUncategorized }: { month: string; hideUncategorized: boolean }) {
  const { unified, nodes } = await getAlerts(month);
  return unified.local
    .filter((k) => k !== 'deliveryTip' && k !== 'overBudget' && !(k === 'uncategorized' && hideUncategorized))
    .map((k) => <Fragment key={k}>{nodes[k]}</Fragment>);
}

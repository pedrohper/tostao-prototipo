import Link from 'next/link';
import type { ChatHistoryResponse, FinancialPlanResponse, TostaoAutoResponse } from '@tostao/contracts';
import { ChatClient } from '@/app/(app)/chat/chat-client';
import { DesktopSplitShell } from '@/components/lateral';
import { AiConsentCard } from '@/components/ai-consent-card';
import { Mascot } from '@/components/mascote';
import { TostaoFindingsBoard } from '@/components/tostao-auto-card';
import { api } from '@/lib/api';
import { getI18n } from '@/lib/i18n-server';
import { modules } from '@/lib/lessons';
import { NO_PROGRESS } from '@/lib/xp';
import { getMe, getProgress, getTostaoAuto } from '@/lib/api-queries';

type WhatsAppStatus = {
  enabled: boolean;
  number: string | null;
  linkedPhone: string | null;
};

const EMPTY_WHATSAPP: WhatsAppStatus = {
  enabled: false,
  number: null,
  linkedPhone: null,
};

const EMPTY_AUTO: TostaoAutoResponse = {
  insights: [],
  history: [],
  config: {
    carameloExtrato: true,
    tostaoPrevisao: true,
    guardiaoLimites: true,
    olheiroAcertos: true,
    notifyPush: false,
    notifyWhatsapp: false,
    lastCheckedAt: null,
  },
};

export default async function TostaoPage({ searchParams }: { searchParams?: Promise<{ aba?: string; q?: string }> }) {
  const [{ locale, t }, sp, me, { messages }, { plan }, progress, auto, whatsapp] = await Promise.all([
    getI18n(),
    searchParams ?? Promise.resolve<{ aba?: string; q?: string }>({}),
    getMe(),
    api<ChatHistoryResponse>('/chat').catch((): ChatHistoryResponse => ({ messages: [] })),
    api<FinancialPlanResponse>('/plan').catch((): FinancialPlanResponse => ({ plan: null })),
    getProgress().catch(() => NO_PROGRESS),
    getTostaoAuto().catch(() => EMPTY_AUTO),
    api<WhatsAppStatus>('/whatsapp').catch(() => EMPTY_WHATSAPP),
  ]);

  const activeTab = sp.aba === 'automatico' ? 'automatico' : 'conversa';
  const pendingCount = auto.insights.length;

  const last = me.connections
    .map((c) => c.lastSyncedAt)
    .filter((x): x is string => Boolean(x))
    .sort()
    .at(-1);
  const tc = t.pages.chatExtra;
  const synced = (() => {
    if (!last) return tc.statusEmpty;
    const d = new Date(last);
    const sameDay =
      d.toLocaleDateString(locale, { timeZone: 'America/Sao_Paulo' }) ===
      new Date().toLocaleDateString(locale, { timeZone: 'America/Sao_Paulo' });
    const dayText = sameDay
      ? t.time.today
      : d.toLocaleDateString(locale, {
          timeZone: 'America/Sao_Paulo',
          day: 'numeric',
          month: 'short',
        });
    const timeText = d.toLocaleTimeString(locale, {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
    return plan ? tc.statusWithPlan(dayText, timeText) : tc.statusWithoutPlan(dayText, timeText);
  })();

  const atualIdx = modules.findIndex((m) => m.lessons.some((l) => !progress.done.includes(l.id)));
  const atual = atualIdx >= 0 ? modules[atualIdx] : null;
  const proxima = atual?.lessons.find((l) => !progress.done.includes(l.id));
  const feitas = atual ? atual.lessons.filter((l) => progress.done.includes(l.id)).length : 0;

  const rightRail = (
    <>
      <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{t.nav.learnHeader}</span>
      <div className="flex flex-col gap-2.5 rounded-[20px] bg-amarelo-claro p-4">
        <Mascot pose="professor" size={88} alt="Tostão" />
        <span className="text-xs font-semibold text-tinta-suave">
          {atual ? t.home.learnModuleProgress(atual.number, feitas, atual.lessons.length) : t.home.allModulesCompleted}
        </span>
        <span className="font-display text-[22px] leading-[26px] font-extrabold text-tinta">
          {atual?.title ?? t.home.allModulesCompleted}
        </span>
        {atual && (
          <div
            className="flex gap-[5px]"
            role="img"
            aria-label={t.home.learnModuleProgress(atual.number, feitas, atual.lessons.length)}
          >
            {atual.lessons.map((lesson) => (
              <i
                key={lesson.id}
                className={`h-2 flex-1 rounded-full ${progress.done.includes(lesson.id) ? 'bg-tinta' : 'bg-cartao'}`}
              />
            ))}
          </div>
        )}
        <Link
          href={proxima ? `/aprender/${proxima.id}` : '/aprender/trilha'}
          className="flex h-11 items-center justify-center rounded-full bg-tinta text-sm font-semibold text-papel no-underline"
        >
          {t.nav.continueLesson}
        </Link>
      </div>

      <Link
        href="/whatsapp?voltar=/tostao"
        className="flex items-center gap-3 rounded-[20px] border border-linha bg-cartao p-4 text-tinta no-underline transition hover:bg-papel-2/50"
      >
        <Mascot pose="acenando" size={52} alt="" still />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">WhatsApp</span>
          <span className="text-[15px] font-bold">
            {whatsapp.linkedPhone ? tc.whatsappConnected : t.profile.shortcuts.whatsapp}
          </span>
          <span className="truncate text-xs text-tinta-suave">
            {whatsapp.linkedPhone ? whatsapp.linkedPhone : whatsapp.enabled ? tc.whatsappLinkHint : tc.whatsappSoon}
          </span>
        </div>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-tinta-suave"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Link>
    </>
  );

  return (
    <DesktopSplitShell rightWidth={340} right={rightRail}>
      <header className="flex items-center justify-between gap-3">
        <Link href="/tostao" aria-label={t.auto.hubTitle} className="flex items-center gap-2.5 text-tinta no-underline">
          <Mascot pose="avatar" size={34} alt="" className="rounded-full" still />
          <span className="font-display text-[22px] leading-none font-extrabold text-tinta lg:text-[24px]">
            {t.auto.hubTitle}
          </span>
        </Link>
        <Link
          href={activeTab === 'automatico' ? '/tostao' : '/tostao?aba=automatico'}
          aria-current={activeTab === 'automatico' ? 'page' : undefined}
          className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold no-underline transition ${
            activeTab === 'automatico'
              ? 'bg-tinta text-papel'
              : 'border border-linha bg-cartao text-tinta hover:bg-papel-2'
          }`}
        >
          <span>{t.auto.tabAuto}</span>
          {pendingCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-laranja px-1.5 text-[11px] font-bold text-tinta-fixa tabular-nums">
              {pendingCount}
            </span>
          )}
        </Link>
      </header>

      {activeTab === 'automatico' ? (
        <div className="flex flex-col gap-5">
          <TostaoFindingsBoard initial={auto} locale={locale} />
          <Link
            href="/mais/alertas?voltar=/tostao?aba=automatico"
            className="flex items-center justify-between gap-3 rounded-[20px] border border-linha bg-cartao p-4 text-tinta no-underline transition hover:bg-papel-2/50"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Mascot pose="dupla" size={44} alt="" still />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-bold">{tc.configTostaoTitle}</span>
                <span className="text-xs leading-[17px] text-tinta-suave">{t.auto.watchesSubtitle}</span>
              </div>
            </div>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0 text-tinta-suave"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      ) : !me.aiConsentAt ? (
        <div className="flex flex-col gap-3">
          <AiConsentCard />
        </div>
      ) : (
        <ChatClient
          initial={messages}
          firstName={me.name.split(' ')[0] ?? me.name}
          subtitle={synced}
          askIncome={!plan}
          initialQuery={sp.q?.trim() || undefined}
          locale={locale}
        />
      )}
    </DesktopSplitShell>
  );
}

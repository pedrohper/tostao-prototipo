import Link from 'next/link';
import type {
  ChatHistoryResponse,
  FinancialPlanResponse,
  LessonProgressResponse,
  ProfileResponse,
  TostaoAutoResponse,
} from '@tostao/contracts';
import { ChatClient } from '@/app/(app)/chat/chat-client';
import { DesktopSplitShell } from '@/components/lateral';
import { Mascot } from '@/components/mascote';
import { TostaoFindingsBoard } from '@/components/tostao-auto-card';
import { api } from '@/lib/api';
import { getI18n } from '@/lib/i18n-server';
import { modules } from '@/lib/lessons';
import { NO_PROGRESS } from '@/lib/xp';

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
    api<ProfileResponse>('/me'),
    api<ChatHistoryResponse>('/chat').catch((): ChatHistoryResponse => ({ messages: [] })),
    api<FinancialPlanResponse>('/plan').catch((): FinancialPlanResponse => ({ plan: null })),
    api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
    api<TostaoAutoResponse>('/tostao/auto').catch(() => EMPTY_AUTO),
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
        <Link href="/tostao" aria-label={t.auto.hubTitle} className="flex items-center text-tinta no-underline">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="-10 -200 626 210"
            className="h-7 w-auto lg:h-8"
            role="img"
            aria-label="Tostão"
          >
            <path
              d="M53.60 2.60Q35 2.60 26.20-7.30Q17.40-17.20 17.40-39L17.40-80.40L2.40-80.40L3-105.40L13.80-105.40Q20.20-105.60 23.50-107.40Q26.80-109.20 27.60-114.20L30.20-129L48.40-129L48.40-105.60L73.80-105.60L73.80-79.40L48.40-79.40L48.40-40.40Q48.40-33.60 51.70-30.40Q55-27.20 61.80-27.20Q65.60-27.20 69-28Q72.40-28.80 74.60-30.20L74.60-0.40Q68.20 1.60 62.90 2.10Q57.60 2.60 53.60 2.60"
              fill="currentColor"
            />
            <path
              d="M136 2.80Q120 2.80 107.70-3.40Q95.40-9.60 88.40-22Q81.40-34.40 81.40-53Q81.40-71.60 88.40-83.90Q95.40-96.20 107.80-102.30Q120.20-108.40 136.20-108.40Q152.20-108.40 164.60-102.20Q177-96 184-83.70Q191-71.40 191-52.80Q191-33.80 183.80-21.40Q176.60-9 164.10-3.10Q151.60 2.80 136 2.80M137-20.60Q144.20-20.60 149-23.90Q153.80-27.20 156.20-34Q158.60-40.80 158.60-50.80Q158.60-61.40 156-68.70Q153.40-76 148.30-79.90Q143.20-83.80 135.20-83.80Q128.40-83.80 123.50-80.50Q118.60-77.20 116.20-70.40Q113.80-63.60 113.80-53.40Q113.80-37 119.90-28.80Q126-20.60 137-20.60"
              fill="currentColor"
            />
            <path
              d="M246.60 2.80Q236 2.80 227.40 0.90Q218.80-1 212.40-4.60Q206-8.20 201.90-13.30Q197.80-18.40 196.20-24.60L220.20-35.20Q221.60-31.80 225.10-28.30Q228.60-24.80 234.50-22.60Q240.40-20.40 248.80-20.40Q256.80-20.40 261.30-22.70Q265.8-25 265.80-29.40Q265.80-32.60 263.30-34.50Q260.80-36.40 255.80-37.90Q250.80-39.40 243.40-40.80Q235.80-42.40 228-44.50Q220.20-46.60 213.40-50.30Q206.60-54 202.50-60.10Q198.40-66.20 198.40-75.60Q198.40-85.40 203.60-92.70Q208.80-100 219.10-104.20Q229.40-108.40 244.20-108.40Q257.40-108.40 267.40-105Q277.40-101.60 284.10-95.30Q290.80-89 293.40-80.20L267.60-71Q266.60-75.40 263.50-78.60Q260.40-81.80 255.70-83.50Q251-85.20 244.60-85.20Q236.80-85.20 232.50-82.80Q228.20-80.40 228.20-76.40Q228.20-73.20 231.10-71.10Q234-69 239.40-67.60Q244.80-66.20 252.20-64.60Q260-63 267.70-60.90Q275.40-58.80 281.70-55.30Q288-51.80 291.70-46.10Q295.40-40.40 295.40-31.40Q295.40-20.80 289.80-13.10Q284.20-5.40 273.30-1.30Q262.40 2.80 246.60 2.80"
              fill="currentColor"
            />
            <path
              d="M348.60 2.60Q330 2.60 321.20-7.30Q312.40-17.20 312.40-39L312.40-80.40L297.40-80.40L298-105.40L308.80-105.40Q315.20-105.60 318.50-107.40Q321.80-109.20 322.60-114.20L325.20-129L343.40-129L343.40-105.60L368.80-105.60L368.80-79.40L343.40-79.40L343.40-40.40Q343.40-33.60 346.70-30.40Q350-27.20 356.80-27.20Q360.60-27.20 364-28Q367.40-28.80 369.60-30.20L369.60-0.40Q363.20 1.60 357.90 2.10Q352.60 2.60 348.60 2.60"
              fill="currentColor"
            />
            <path
              d="M407.20 2.80Q398.40 2.80 391.60-0.70Q384.80-4.20 381-10.90Q377.20-17.60 377.20-27.20Q377.20-36.20 380.70-42.10Q384.20-48 390.90-51.50Q397.60-55 407-57.30Q416.40-59.60 428.40-61.40Q434.20-62.40 438.10-63.30Q442-64.20 444-66.20Q446-68.20 446-72Q446-77 442.40-80.60Q438.80-84.20 430.80-84.20Q425.20-84.20 420.70-82.20Q416.20-80.20 413-76.40Q409.80-72.60 408.20-67.20L379.80-75.60Q382.40-84 387.10-90.20Q391.80-96.40 398.40-100.50Q405-104.60 413.50-106.50Q422-108.40 431.60-108.40Q447.60-108.40 457.70-103.30Q467.80-98.20 472.70-87.50Q477.60-76.80 477.60-60L477.60-43.80Q477.60-36.60 477.90-29.30Q478.20-22 478.70-14.70Q479.20-7.40 480 0L451.60 0Q450.80-4.60 450-11.10Q449.20-17.60 448.80-24.40L445-24.40Q442.20-16.80 436.90-10.50Q431.60-4.20 424.10-0.70Q416.60 2.80 407.20 2.80M421.80-20Q425.40-20 429.10-21.30Q432.80-22.60 436.20-24.90Q439.60-27.20 442.40-30.60Q445.20-34 446.60-38L446.20-50.60Q444.40-49.60 442.20-49Q437.60-47.60 432.90-46.80Q428.20-46 423.70-45.10Q419.20-44.20 415.70-42.80Q412.20-41.40 410.20-39Q408.20-36.60 408.20-32.40Q408.20-26.80 412-23.40Q415.80-20 421.80-20"
              fill="currentColor"
            />
            <path
              d="M544 2.80Q528 2.80 515.70-3.40Q503.40-9.60 496.40-22Q489.40-34.40 489.40-53Q489.40-71.60 496.40-83.90Q503.40-96.20 515.80-102.30Q528.20-108.40 544.20-108.40Q560.20-108.40 572.60-102.20Q585-96 592-83.70Q599-71.40 599-52.80Q599-33.80 591.80-21.40Q584.60-9 572.10-3.10Q559.60 2.80 544 2.80M545-20.60Q552.20-20.60 557-23.90Q561.80-27.20 564.20-34Q566.60-40.80 566.60-50.80Q566.60-61.40 564-68.70Q561.40-76 556.30-79.90Q551.20-83.80 543.20-83.80Q536.40-83.80 531.50-80.50Q526.60-77.20 524.20-70.40Q521.80-63.60 521.80-53.40Q521.80-37 527.90-28.80Q534-20.60 545-20.60"
              fill="currentColor"
            />
            <path
              d="M391.3 -140.0 C 403.0 -160.3 423.1 -158.7 430.1 -141.2 C 435.9 -128.0 453.6 -124.9 462.3 -139.6 C 469.9 -153.5 452.7 -165.6 442.4 -153.3 C 434.4 -142.5 450.4 -129.5 464.5 -129.0 C 472.6 -128.6 479.5 -133.5 482.7 -140.0"
              fill="none"
              stroke="var(--color-laranja)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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

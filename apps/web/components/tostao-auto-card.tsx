'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  TostaoAutoConfigDTO,
  TostaoAutoResponse,
  TostaoInsightDTO,
  TostaoRoutineKey,
  UpdateTostaoAutoConfigBody,
} from '@tostao/contracts';
import { Mascot, type MascotPose } from './mascote';
import { ago } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';
import {
  applyTostaoInsightAction,
  dismissTostaoInsightAction,
  runTostaoCheckAction,
  updateTostaoAutoConfigAction,
} from '@/lib/tostao-auto-actions';

const ROUTINE_POSE: Record<TostaoRoutineKey, MascotPose> = {
  caramelo_extrato: 'caramelo-farejando',
  tostao_previsao: 'preocupado',
  guardiao_limites: 'investigando',
  olheiro_acertos: 'caramelo-bravo',
};

const SEVERITY_CARD: Record<TostaoInsightDTO['severity'], string> = {
  urgent: 'border-vermelho-texto/35 bg-rosa',
  warning: 'border-laranja/40 bg-amarelo-claro',
  info: 'border-linha bg-cartao',
};

const INLINE_APPLY_KINDS = new Set(['uncategorized_batch', 'duplicate_subscription', 'possible_internal_transfer']);

/** Lista os achados do Tostão & Caramelo (usado em /inicio em resumo e em /tostao?aba=automatico completo). */
export function TostaoFindingsBoard({
  initial,
  locale = 'pt-BR',
  compact = false,
  seeAllHref = '/tostao?aba=automatico',
}: {
  initial: TostaoAutoResponse;
  locale?: Locale;
  compact?: boolean;
  seeAllHref?: string;
}) {
  const router = useRouter();
  const t = getDictionary(locale);
  const [state, setState] = useState<TostaoAutoResponse>(initial);
  const [banner, setBanner] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [nowTick, setNowTick] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setNowTick(Date.now()), 0);
    return () => clearTimeout(timer);
  }, []);

  const insights = compact ? state.insights.slice(0, 3) : state.insights;

  const handleCheck = () => {
    setBanner(null);
    startTransition(async () => {
      try {
        const next = await runTostaoCheckAction();
        setState(next);
        setNowTick(Date.now());
        setBanner(next.generated > 0 ? t.auto.newFindingsBanner(next.generated) : t.auto.allCheckedBanner);
      } catch {
        setBanner(t.auto.checkErrorBanner);
      }
    });
  };

  const handleApply = (insight: TostaoInsightDTO) => {
    setBusyId(insight.id);
    setBanner(null);
    startTransition(async () => {
      try {
        if (INLINE_APPLY_KINDS.has(insight.kind)) {
          const res = await applyTostaoInsightAction(insight.id);
          setState((prev) => ({
            ...prev,
            insights: prev.insights.filter((i) => i.id !== insight.id),
            history: [res.insight, ...prev.history].slice(0, 15),
          }));
          setBanner(res.appliedSummary);
          if (res.redirectTo && insight.kind === 'uncategorized_batch') {
            router.refresh();
          }
        } else {
          await applyTostaoInsightAction(insight.id).catch(() => null);
          if (insight.actionHref) router.push(insight.actionHref);
        }
      } finally {
        setBusyId(null);
      }
    });
  };

  const handleDismiss = (insight: TostaoInsightDTO) => {
    setBusyId(insight.id);
    startTransition(async () => {
      try {
        const updated = await dismissTostaoInsightAction(insight.id);
        setState((prev) => ({
          ...prev,
          insights: prev.insights.filter((i) => i.id !== insight.id),
          history: [updated, ...prev.history].slice(0, 15),
        }));
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-extrabold">{t.auto.foundTitle}</h2>
            {state.insights.length > 0 && (
              <span className="rounded-full bg-laranja px-2 py-0.5 text-xs font-bold text-tinta-fixa">
                {state.insights.length}
              </span>
            )}
            <button
              type="button"
              onClick={handleCheck}
              disabled={isPending}
              aria-label={isPending && !busyId ? t.auto.checkingNow : t.auto.checkNow}
              title={isPending && !busyId ? t.auto.checkingNow : t.auto.checkNow}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-linha bg-cartao text-tinta transition hover:bg-papel-2 disabled:opacity-50 after:absolute after:-inset-1 after:content-['']"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={isPending && !busyId ? 'animate-spin' : ''}
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
          </div>
          {!compact && (
            <span className="text-xs text-tinta-suave">
              {state.config.lastCheckedAt && nowTick
                ? t.auto.lastChecked(ago(state.config.lastCheckedAt, nowTick, locale))
                : state.config.lastCheckedAt
                  ? t.auto.lastChecked(t.time.now)
                  : t.auto.neverChecked}
            </span>
          )}
        </div>
        {compact && state.insights.length > 0 && (
          <button
            type="button"
            onClick={() => router.push(seeAllHref)}
            className="text-xs font-semibold text-laranja-texto hover:underline"
          >
            {t.home.viewAll}
          </button>
        )}
      </div>

      {banner && (
        <p
          role="status"
          className="rounded-2xl border border-linha bg-menta-clara px-3.5 py-2.5 text-xs font-semibold text-tinta"
        >
          {banner}
        </p>
      )}

      {insights.length === 0 ? (
        <div className="flex items-center gap-3 rounded-[20px] border border-linha bg-cartao p-4">
          <Mascot pose="dupla" size={52} alt="Tostão e Caramelo" still />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{t.auto.emptyFoundTitle}</span>
            <p className="text-[13px] leading-[18px] text-tinta-suave">{t.auto.emptyFoundBody}</p>
          </div>
        </div>
      ) : (
        <div className={`grid gap-2.5 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
          {insights.map((item) => {
            const routineMeta = t.auto.routines[item.routine];
            const isBusy = busyId === item.id;
            return (
              <div
                key={item.id}
                className={`flex min-w-0 flex-col justify-between gap-3 rounded-[20px] border p-4 ${SEVERITY_CARD[item.severity]}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Mascot pose={ROUTINE_POSE[item.routine]} size={44} alt="" still />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[11px] font-bold tracking-[0.06em] text-tinta-suave uppercase">
                      {routineMeta.badge}
                    </span>
                    <span className="break-words text-[15px] leading-5 font-bold">{item.title}</span>
                    <p className="break-words text-[13px] leading-[18px] text-tinta-suave">{item.body}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDismiss(item)}
                    className="h-9 rounded-full px-3 text-xs font-semibold text-tinta-suave hover:bg-tinta/10 disabled:opacity-50"
                  >
                    {t.auto.dismissLabel}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleApply(item)}
                    className="h-9 rounded-full bg-tinta px-4 text-xs font-semibold text-papel disabled:opacity-50"
                  >
                    {isBusy ? '…' : item.actionLabel}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!compact && state.history.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
            {t.auto.recentHistoryTitle}
          </span>
          <div className="flex flex-col divide-y divide-linha rounded-[20px] border border-linha bg-cartao px-4">
            {state.history.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="block truncate font-semibold text-tinta">{item.title}</span>
                  <span className="text-xs text-tinta-suave">{t.auto.routines[item.routine].title}</span>
                </div>
                <span className="shrink-0 rounded-full bg-papel-2 px-2.5 py-0.5 text-[11px] font-semibold text-tinta-suave">
                  {item.status === 'APPLIED' ? t.auto.statusApplied : t.auto.statusDismissed}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** O que o Tostão acompanha + canais Push/WhatsApp (para /mais e /tostao). */
export function TostaoAutoConfigPanel({
  initialConfig,
  whatsappLinked,
  locale = 'pt-BR',
}: {
  initialConfig: TostaoAutoConfigDTO;
  whatsappLinked: boolean;
  locale?: Locale;
}) {
  const t = getDictionary(locale);
  const [config, setConfig] = useState<TostaoAutoConfigDTO>(initialConfig);
  const [, startTransition] = useTransition();

  const toggle = (key: keyof UpdateTostaoAutoConfigBody) => {
    const nextVal = !config[key];
    setConfig((prev) => ({ ...prev, [key]: nextVal }));
    startTransition(async () => {
      try {
        const saved = await updateTostaoAutoConfigAction({ [key]: nextVal });
        setConfig(saved);
      } catch {
        setConfig((prev) => ({ ...prev, [key]: !nextVal }));
      }
    });
  };

  const routineRows: {
    key: 'carameloExtrato' | 'tostaoPrevisao' | 'guardiaoLimites' | 'olheiroAcertos';
    id: TostaoRoutineKey;
    pose: MascotPose;
  }[] = [
    { key: 'carameloExtrato', id: 'caramelo_extrato', pose: 'caramelo-farejando' },
    { key: 'tostaoPrevisao', id: 'tostao_previsao', pose: 'preocupado' },
    { key: 'guardiaoLimites', id: 'guardiao_limites', pose: 'investigando' },
    { key: 'olheiroAcertos', id: 'olheiro_acertos', pose: 'caramelo-feliz' },
  ];

  return (
    <div id="avisos" className="flex scroll-mt-6 flex-col gap-3 rounded-[20px] border border-linha bg-cartao p-4">
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-[17px] font-extrabold">{t.auto.watchesTitle}</span>
        <span className="text-xs leading-[18px] text-tinta-suave">{t.auto.watchesSubtitle}</span>
      </div>

      <div className="flex flex-col divide-y divide-linha">
        {routineRows.map((row) => {
          const meta = t.auto.routines[row.id];
          const checked = config[row.key];
          return (
            <label key={row.key} className="flex cursor-pointer items-center gap-3 py-3 first:pt-1 last:pb-1">
              <Mascot pose={row.pose} size={36} alt="" still />
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{meta.title}</span>
                <span className="block text-xs leading-[17px] text-tinta-suave">{meta.description}</span>
              </div>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(row.key)}
                className="h-5 w-5 shrink-0 accent-tinta"
              />
            </label>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 border-t border-linha pt-3">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold">
          <span>{t.auto.pushChannelLabel}</span>
          <input
            type="checkbox"
            checked={config.notifyPush}
            onChange={() => toggle('notifyPush')}
            className="h-5 w-5 shrink-0 accent-tinta"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold">
          <span className="flex flex-col">
            <span>{t.auto.whatsappChannelLabel}</span>
            {!whatsappLinked && (
              <span className="text-[11px] font-normal text-tinta-suave">{t.auto.whatsappNeedLinkHint}</span>
            )}
          </span>
          <input
            type="checkbox"
            checked={config.notifyWhatsapp}
            onChange={() => toggle('notifyWhatsapp')}
            className="h-5 w-5 shrink-0 accent-tinta"
          />
        </label>
      </div>
    </div>
  );
}

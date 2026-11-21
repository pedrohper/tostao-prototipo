import Link from 'next/link';
import type { PushKeyResponse, TostaoAutoConfigDTO } from '@tostao/contracts';
import { PushNotificationCard } from '@/components/avisos';
import { Icon } from '@/components/icone';
import { TostaoAutoConfigPanel } from '@/components/tostao-auto-card';
import { BackLink, PageFrame } from '@/components/ui';
import { api } from '@/lib/api';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { getTostaoAuto } from '@/lib/api-queries';

type WhatsAppStatus = {
  enabled: boolean;
  number: string | null;
  linkedPhone: string | null;
};

const DEFAULT_AUTO_CONFIG: TostaoAutoConfigDTO = {
  carameloExtrato: true,
  tostaoPrevisao: true,
  guardiaoLimites: true,
  olheiroAcertos: true,
  notifyPush: true,
  notifyWhatsapp: false,
  lastCheckedAt: null,
};

export default async function MaisAlertasPage({ searchParams }: { searchParams?: Promise<{ voltar?: string }> }) {
  const [sp, wa, auto, pushKeyData, { locale, t }] = await Promise.all([
    searchParams ?? Promise.resolve<{ voltar?: string }>({}),
    api<WhatsAppStatus>('/whatsapp').catch(() => null),
    getTostaoAuto().catch(() => null),
    api<PushKeyResponse>('/push/key').catch(() => null),
    getI18n(),
  ]);

  const backHref = resolveBackHref(sp.voltar, '/mais');
  const title = locale === 'en' ? 'WhatsApp & Alerts' : locale === 'es' ? 'WhatsApp y Alertas' : 'WhatsApp & Alertas';

  return (
    <PageFrame size="focused">
      <div className="flex items-center gap-1">
        <BackLink href={backHref} label={t.common.back} />
        <h1 className="truncate font-display text-[24px] leading-[30px] font-extrabold text-tinta">{title}</h1>
      </div>

      <Link
        href={`/whatsapp?voltar=${encodeURIComponent('/mais/alertas')}`}
        className="flex min-h-[68px] items-center justify-between gap-3 rounded-[20px] border border-linha bg-cartao px-4 py-3.5 text-tinta no-underline transition-colors hover:bg-papel-2"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Icon src="ui/whatsapp-chat" size={24} className="shrink-0 text-verde-texto" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-bold text-tinta">{t.profile.shortcuts.whatsapp}</span>
            <span className="text-xs leading-[17px] text-tinta-suave">
              {wa?.linkedPhone
                ? t.profile.whatsappConnectedPhone(wa.linkedPhone)
                : wa && !wa.enabled
                  ? t.profile.whatsappServerConnecting
                  : t.profile.whatsappDisconnectedHint}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              wa?.linkedPhone ? 'bg-menta-clara text-verde-texto' : 'bg-papel-2 text-tinta-suave'
            }`}
          >
            {wa?.linkedPhone ? t.profile.whatsappConnectedBadge : t.profile.whatsappOffBadge}
          </span>
          <span className="text-tinta-suave" aria-hidden="true">
            ›
          </span>
        </div>
      </Link>

      <TostaoAutoConfigPanel
        initialConfig={auto?.config ?? DEFAULT_AUTO_CONFIG}
        whatsappLinked={Boolean(wa?.linkedPhone)}
        locale={locale}
      />

      <PushNotificationCard publicKey={pushKeyData?.publicKey ?? null} locale={locale} />
    </PageFrame>
  );
}

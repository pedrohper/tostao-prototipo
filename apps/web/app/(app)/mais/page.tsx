import Link from 'next/link';
import type {
  LessonProgressResponse,
  ProfileResponse,
  PushKeyResponse,
  TostaoAutoConfigDTO,
  TostaoAutoResponse,
} from '@tostao/contracts';
import { PushNotificationCard } from '@/components/avisos';
import { getBankLogos, BankBadge } from '@/components/banco';
import { LanguageSwitcher } from '@/components/language-switcher';
import { DesktopSplitShell } from '@/components/lateral';
import { Mascot } from '@/components/mascote';
import { SoundToggleCard } from '@/components/sons';
import { TostaoAutoConfigPanel } from '@/components/tostao-auto-card';
import { Eyebrow } from '@/components/ui';
import { Icon } from '@/components/icone';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import type { Dictionary, Locale } from '@/lib/i18n';
import { getI18n } from '@/lib/i18n-server';
import { NO_PROGRESS, xpFrom } from '@/lib/xp';
import { AddAccountBox } from '../carteira/add-account';
import { HideAccountButton } from '../carteira/hide-account-button';

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

function formatLastSync(iso: string | null, locale: Locale, t: Dictionary) {
  if (!iso) return t.profile.notUpdatedYet;
  const date = new Date(iso);
  const tz = { timeZone: 'America/Sao_Paulo' } as const;
  const isToday = date.toLocaleDateString(locale, tz) === new Date().toLocaleDateString(locale, tz);
  const dayText = isToday
    ? t.time.today
    : date.toLocaleDateString(locale, { ...tz, day: 'numeric', month: 'short' }).replace('.', '');
  const timeText = date.toLocaleTimeString(locale, { ...tz, hour: '2-digit', minute: '2-digit' });
  return t.profile.updatedAtLabel(dayText, timeText);
}

export default async function MaisPage() {
  const [profile, { done, streakDays, bonusXp = 0 }, wa, auto, pushKeyData, bankLogos, { locale, t }] =
    await Promise.all([
      api<ProfileResponse>('/me'),
      api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
      api<WhatsAppStatus>('/whatsapp').catch(() => null),
      api<TostaoAutoResponse>('/tostao/auto').catch(() => null),
      api<PushKeyResponse>('/push/key').catch(() => null),
      getBankLogos(),
      getI18n(),
    ]);

  const { xp, level } = xpFrom(done.length, bonusXp);
  const openFinanceConns = profile.connections.filter((c) => !c.itemId.startsWith('import:'));
  const hasOpenFinanceError = openFinanceConns.some((c) => c.status === 'ERROR');

  const fixConnectionLabel =
    locale === 'en' ? 'Review connections' : locale === 'es' ? 'Revisar conexiones' : 'Resolver conexão';
  const viewProfileLabel =
    locale === 'en' ? 'Profile & achievements' : locale === 'es' ? 'Perfil y logros' : 'Ver perfil e conquistas';
  const alertsEyebrow =
    locale === 'en'
      ? 'WhatsApp & What Tostão watches'
      : locale === 'es'
        ? 'WhatsApp y lo que Tostão acompaña'
        : 'WhatsApp & O que o Tostão acompanha';
  const preferencesEyebrow = locale === 'en' ? 'Preferences' : locale === 'es' ? 'Preferencias' : 'Preferências';
  const accountLegalEyebrow =
    locale === 'en' ? 'Account & Legal' : locale === 'es' ? 'Cuenta y Legal' : 'Conta & Legal';
  const importLabel =
    locale === 'en'
      ? 'Import OFX or CSV statement'
      : locale === 'es'
        ? 'Importar extracto OFX o CSV'
        : 'Importar extrato (OFX ou CSV)';

  const secondarySections = (
    <>
      {/* Preferências */}
      <section className="flex flex-col gap-2.5">
        <Eyebrow>{preferencesEyebrow}</Eyebrow>
        <div className="flex flex-col divide-y divide-linha rounded-[22px] border border-linha bg-cartao px-[18px] py-1">
          <SoundToggleCard locale={locale} embedded />
          <LanguageSwitcher locale={locale} embedded />
        </div>
        <Link
          href="/inicio/personalizar?voltar=/mais"
          className="flex items-center justify-between gap-3 rounded-[22px] border border-linha bg-cartao px-[18px] py-3.5 text-tinta no-underline transition-colors hover:bg-papel-2"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-tinta">{t.home.customizeHome}</span>
            <span className="text-[13px] leading-[19px] text-tinta-suave">{t.pages.personalizar.subtitle}</span>
          </div>
          <span className="shrink-0 text-tinta-suave" aria-hidden="true">
            ›
          </span>
        </Link>
      </section>

      {/* Conta & Legal */}
      <section className="flex flex-col gap-2.5">
        <Eyebrow>{accountLegalEyebrow}</Eyebrow>
        <div className="flex flex-col divide-y divide-linha rounded-[22px] border border-linha bg-cartao px-[18px] py-1">
          <Link
            href="/termos"
            className="flex min-h-12 items-center justify-between gap-3 text-[15px] font-semibold text-tinta no-underline transition-opacity hover:opacity-80"
          >
            <span>{t.legal.termsLink}</span>
            <span className="shrink-0 text-tinta-suave" aria-hidden="true">
              ›
            </span>
          </Link>
          <Link
            href="/privacidade"
            className="flex min-h-12 items-center justify-between gap-3 text-[15px] font-semibold text-tinta no-underline transition-opacity hover:opacity-80"
          >
            <span>{t.legal.privacyLink}</span>
            <span className="shrink-0 text-tinta-suave" aria-hidden="true">
              ›
            </span>
          </Link>
          <Link
            href="/conectar?voltar=/mais"
            className="flex min-h-12 items-center justify-between gap-3 text-[15px] font-semibold text-vermelho-texto no-underline hover:underline"
          >
            <span>{t.profile.disconnectBanks}</span>
            <span className="shrink-0" aria-hidden="true">
              ›
            </span>
          </Link>
          <Link
            href="/perfil/apagar-conta?voltar=/mais"
            className="flex min-h-12 items-center justify-between gap-3 text-[15px] font-semibold text-vermelho-texto no-underline hover:underline"
          >
            <span>{t.profile.deleteAccount}</span>
            <span className="shrink-0" aria-hidden="true">
              ›
            </span>
          </Link>
          <a
            href="/sair"
            className="flex min-h-12 items-center text-[15px] font-semibold text-tinta-suave no-underline hover:text-tinta"
          >
            {t.profile.signOut}
          </a>
        </div>
      </section>

      <div className="flex items-center gap-3 rounded-2xl bg-amarelo-claro px-4 py-3">
        <Mascot pose="caramelo-moeda" size={52} alt="Caramelo" />
        <p className="min-w-0 text-[13px] leading-[19px] text-tinta">{t.profile.prototypeBanner}</p>
      </div>
    </>
  );

  return (
    <DesktopSplitShell rightWidth={340} right={secondarySections}>
      <h1 className="font-display text-[34px] leading-[38px] font-extrabold lg:text-[40px] lg:leading-[44px]">
        {t.profile.title}
      </h1>

      {/* 1) Perfil (link direto pra /perfil) + Alerta Open Finance só se houver erro */}
      <section className="flex flex-col gap-3">
        <Link
          href="/perfil?voltar=/mais"
          className="flex items-center gap-4 rounded-[22px] border border-linha bg-cartao p-5 text-tinta no-underline transition-colors hover:bg-papel-2"
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-laranja font-display text-[28px] font-extrabold text-tinta-fixa">
            {profile.name.trim().charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[19px] font-bold text-tinta">{profile.name}</span>
            <span className="truncate text-[13px] text-tinta-suave">{profile.email}</span>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-papel-2 px-2.5 py-0.5 text-xs font-semibold text-tinta">
                {t.profile.levelSummary(level, xp, streakDays)}
              </span>
              <span className="text-xs font-semibold text-laranja-texto">{viewProfileLabel}</span>
            </div>
          </div>
          <span className="shrink-0 text-xl text-tinta-suave" aria-hidden="true">
            ›
          </span>
        </Link>

        {hasOpenFinanceError && (
          <div className="flex flex-col justify-center gap-1 rounded-[22px] border border-vermelho-texto/25 bg-rosa px-5 py-4">
            <span className="text-[15px] font-bold text-vermelho-texto">{t.profile.openFinanceError}</span>
            <span className="text-[14px] leading-5 text-tinta-suave">{t.profile.openFinanceNote}</span>
            <Link
              href="/conectar?voltar=/mais"
              className="mt-0.5 self-start text-sm font-semibold text-laranja-texto underline"
            >
              {fixConnectionLabel} ›
            </Link>
          </div>
        )}
      </section>

      {/* 2) Contas conectadas & Extratos */}
      <section className="flex flex-col gap-2.5">
        <Eyebrow>{t.profile.connectedAccounts}</Eyebrow>
        <div className="flex flex-col rounded-[22px] border border-linha bg-cartao px-[18px] py-1">
          {profile.connections.map((conn) => {
            const isImported = conn.itemId.startsWith('import:');
            return (
              <div key={conn.id} className="flex flex-col border-b border-linha py-1.5">
                <Link
                  href="/conectar?voltar=/mais"
                  className="flex min-h-11 items-center justify-between gap-3 text-tinta no-underline"
                >
                  <span className="min-w-0 truncate text-[15px] font-semibold">{conn.displayName}</span>
                  <span
                    className={`shrink-0 text-right text-xs ${
                      conn.status === 'ERROR' && !isImported ? 'font-semibold text-vermelho-texto' : 'text-tinta-suave'
                    }`}
                  >
                    {isImported
                      ? t.profile.importedStatement
                      : conn.status === 'ERROR'
                        ? t.profile.stoppedUpdating
                        : formatLastSync(conn.lastSyncedAt, locale, t)}
                  </span>
                </Link>
                {conn.accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`flex min-h-9 items-center gap-2 pb-1 text-[13px] ${account.hidden ? 'text-tinta-suave' : 'text-tinta'}`}
                  >
                    <BankBadge nome={account.name} instituicao={conn.displayName} size={20} logos={bankLogos} />
                    <span className={`min-w-0 grow truncate ${account.hidden ? 'line-through' : ''}`}>
                      {account.name}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {money(account.type === 'CREDIT' ? Math.max(0, -account.balanceInCents) : account.balanceInCents)}
                    </span>
                    <HideAccountButton accountId={account.id} hidden={account.hidden} t={t.walletExtra.hideAccount} />
                  </div>
                ))}
              </div>
            );
          })}
          <Link
            href="/conectar?voltar=/mais"
            className="flex min-h-[50px] items-center gap-2 border-b border-linha text-[15px] font-semibold text-laranja-texto no-underline"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {profile.connections.length ? t.profile.connectAnotherBank : t.profile.connectMyBank}
          </Link>
          <Link
            href="/importar?voltar=/mais"
            className="flex min-h-[50px] items-center justify-between gap-2 text-[15px] font-semibold text-tinta no-underline transition-opacity hover:opacity-80"
          >
            <span className="flex items-center gap-2">
              <Icon src="conectar/extrato" size={20} />
              <span>{importLabel}</span>
            </span>
            <span className="shrink-0 text-tinta-suave" aria-hidden="true">
              ›
            </span>
          </Link>
        </div>
        <AddAccountBox t={t.walletExtra.addAccount} cancelLabel={t.common.cancel} />
        <p className="text-[13px] leading-[19px] text-tinta-suave">{t.profile.hiddenAccountHint}</p>
      </section>

      {/* 3) WhatsApp & O que o Tostão acompanha (#avisos) */}
      <section className="flex flex-col gap-3">
        <Eyebrow>{alertsEyebrow}</Eyebrow>
        <Link
          href="/whatsapp?voltar=/mais"
          className="flex items-center justify-between gap-3 rounded-[20px] border border-linha bg-cartao px-4 py-3.5 text-tinta no-underline transition-colors hover:bg-papel-2"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Icon src="ui/whatsapp-chat" size={24} className="text-verde-texto" />
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
      </section>

      {/* Mobile-only Preferences + Account & Legal (< 1024px) */}
      <div className="flex flex-col gap-5 lg:hidden">{secondarySections}</div>
    </DesktopSplitShell>
  );
}

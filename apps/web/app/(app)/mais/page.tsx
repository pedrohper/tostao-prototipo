import Link from 'next/link';
import type { LessonProgressResponse, ProfileResponse, TostaoAutoResponse } from '@tostao/contracts';
import { Eyebrow } from '@/components/ui';
import { Icon } from '@/components/icone';
import { DesktopSplitShell } from '@/components/lateral';
import { Mascot } from '@/components/mascote';
import { api } from '@/lib/api';
import { getI18n } from '@/lib/i18n-server';
import { NO_PROGRESS, xpFrom } from '@/lib/xp';

type WhatsAppStatus = {
  enabled: boolean;
  number: string | null;
  linkedPhone: string | null;
};

export default async function MaisPage() {
  const [profile, { done, streakDays, bonusXp = 0 }, wa, auto, { locale, t }] = await Promise.all([
    api<ProfileResponse>('/me'),
    api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
    api<WhatsAppStatus>('/whatsapp').catch(() => null),
    api<TostaoAutoResponse>('/tostao/auto').catch(() => null),
    getI18n(),
  ]);

  const { xp, level } = xpFrom(done.length, bonusXp);
  const openFinanceConns = profile.connections.filter((c) => !c.isImport);
  const hasOpenFinanceError = openFinanceConns.some((c) => c.status === 'ERROR' || c.status === 'RECONNECT_REQUIRED');
  const totalAccounts = profile.connections.reduce((sum, conn) => sum + conn.accounts.length, 0);
  const pendingInsights = auto?.insights.length ?? 0;

  const fixConnectionLabel =
    locale === 'en' ? 'Review connections' : locale === 'es' ? 'Revisar conexiones' : 'Resolver conexão';
  const viewProfileLabel =
    locale === 'en' ? 'Account & achievements' : locale === 'es' ? 'Cuenta y logros' : 'Conta e conquistas';

  const myWalletTitle = locale === 'en' ? 'My wallet' : locale === 'es' ? 'Mi cartera' : 'Minha carteira';
  const myWalletSub =
    locale === 'en'
      ? `${profile.connections.length} connections · ${totalAccounts} accounts and cards`
      : locale === 'es'
        ? `${profile.connections.length} conexiones · ${totalAccounts} cuentas y tarjetas`
        : totalAccounts > 0
          ? `${totalAccounts} ${totalAccounts === 1 ? 'conta e cartão' : 'contas e cartões'} · bancos e extratos`
          : 'Conectar bancos, ocultar contas e importar extrato';

  const alertsTitle =
    locale === 'en' ? 'WhatsApp & Alerts' : locale === 'es' ? 'WhatsApp y Alertas' : 'WhatsApp & Alertas';
  const alertsSub = wa?.linkedPhone
    ? t.profile.whatsappConnectedPhone(wa.linkedPhone)
    : locale === 'en'
      ? 'Notifications and what Tostão monitors'
      : locale === 'es'
        ? 'Notificaciones y lo que vigila Tostão'
        : 'Avisos no celular e o que o Tostão acompanha';

  const prefsTitle = locale === 'en' ? 'Preferences' : locale === 'es' ? 'Preferencias' : 'Preferências';
  const prefsSub =
    locale === 'en'
      ? 'Sounds, language, and home layout'
      : locale === 'es'
        ? 'Sonidos, idioma y pantalla de inicio'
        : 'Sons, idioma e personalizar o Início';

  const aboutTitle = locale === 'en' ? 'About & Legal' : locale === 'es' ? 'Acerca y Legal' : 'Sobre & Legal';
  const aboutSub =
    locale === 'en'
      ? 'Terms of use, privacy, and app info'
      : locale === 'es'
        ? 'Términos, privacidad e info de la app'
        : 'Termos de uso, privacidade e informações';

  const rightRail = (
    <>
      <Eyebrow>{locale === 'en' ? 'Quick access' : locale === 'es' ? 'Acceso rápido' : 'Atalhos'}</Eyebrow>
      <Link
        href="/tostao?aba=automatico"
        className="flex items-center justify-between gap-3 rounded-[20px] border border-linha bg-cartao p-4 text-tinta no-underline transition hover:bg-papel-2"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Mascot pose="investigando" size={44} alt="" still />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{t.auto.tabAuto}</span>
            <span className="truncate text-xs text-tinta-suave">
              {pendingInsights > 0
                ? locale === 'en'
                  ? `${pendingInsights} pending items`
                  : locale === 'es'
                    ? `${pendingInsights} pendientes`
                    : `${pendingInsights} achados para revisar`
                : t.auto.emptyFoundTitle}
            </span>
          </div>
        </div>
        <span className="shrink-0 text-tinta-suave" aria-hidden="true">
          ›
        </span>
      </Link>

      <div className="flex items-center gap-3 rounded-2xl bg-amarelo-claro px-4 py-3">
        <Mascot pose="caramelo-moeda" size={52} alt="Caramelo" />
        <p className="min-w-0 text-[13px] leading-[19px] text-tinta">{t.profile.prototypeBanner}</p>
      </div>
    </>
  );

  return (
    <DesktopSplitShell rightWidth={340} right={rightRail}>
      <h1 className="font-display text-[24px] leading-[30px] font-extrabold lg:text-[28px] lg:leading-[34px]">
        {t.profile.title}
      </h1>

      {/* 1) Perfil + Alerta Open Finance só se houver erro */}
      <section className="flex flex-col gap-3">
        <Link
          href="/perfil?voltar=/mais"
          className="flex items-center gap-4 rounded-[22px] border border-linha bg-cartao p-4 text-tinta no-underline transition-colors hover:bg-papel-2 sm:p-5"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-laranja font-display text-[24px] font-extrabold text-tinta-fixa sm:h-16 sm:w-16 sm:text-[28px]">
            {profile.name.trim().charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[18px] font-bold text-tinta sm:text-[19px]">{profile.name}</span>
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

      {/* 2) Menu enxuto de sub-telas */}
      <nav
        aria-label={t.profile.title}
        className="flex flex-col divide-y divide-linha rounded-[22px] border border-linha bg-cartao px-4 py-1"
      >
        <Link
          href="/carteira/editar?voltar=/mais"
          className="flex min-h-[68px] items-center gap-3.5 py-3 text-tinta no-underline transition-opacity hover:opacity-80"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-papel-2 text-tinta">
            <Icon src="ui/banco" size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{myWalletTitle}</span>
            <span className="truncate text-xs text-tinta-suave">{myWalletSub}</span>
          </span>
          <span className="shrink-0 text-lg text-tinta-suave" aria-hidden="true">
            ›
          </span>
        </Link>

        <Link
          href="/mais/alertas"
          className="flex min-h-[68px] items-center gap-3.5 py-3 text-tinta no-underline transition-opacity hover:opacity-80"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-menta-clara text-verde-texto">
            <Icon src="ui/whatsapp-chat" size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2 text-[15px] font-bold">
              <span>{alertsTitle}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  wa?.linkedPhone ? 'bg-menta-clara text-verde-texto' : 'bg-papel-2 text-tinta-suave'
                }`}
              >
                {wa?.linkedPhone ? t.profile.whatsappConnectedBadge : t.profile.whatsappOffBadge}
              </span>
            </span>
            <span className="truncate text-xs text-tinta-suave">{alertsSub}</span>
          </span>
          <span className="shrink-0 text-lg text-tinta-suave" aria-hidden="true">
            ›
          </span>
        </Link>

        <Link
          href="/mais/preferencias"
          className="flex min-h-[68px] items-center gap-3.5 py-3 text-tinta no-underline transition-opacity hover:opacity-80"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amarelo-claro text-tinta">
            <Icon src="ui/preferencias" size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{prefsTitle}</span>
            <span className="truncate text-xs text-tinta-suave">{prefsSub}</span>
          </span>
          <span className="shrink-0 text-lg text-tinta-suave" aria-hidden="true">
            ›
          </span>
        </Link>

        <Link
          href="/mais/sobre"
          className="flex min-h-[68px] items-center gap-3.5 py-3 text-tinta no-underline transition-opacity hover:opacity-80"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-papel-2 text-tinta-suave">
            <Icon src="ui/sobre" size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{aboutTitle}</span>
            <span className="truncate text-xs text-tinta-suave">{aboutSub}</span>
          </span>
          <span className="shrink-0 text-lg text-tinta-suave" aria-hidden="true">
            ›
          </span>
        </Link>
      </nav>
    </DesktopSplitShell>
  );
}

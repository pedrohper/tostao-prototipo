'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { getDictionary, type Locale } from '@/lib/i18n';
import { isOnboardingActive, onboardingProgress, onboardingStep } from '@/lib/onboarding';

const MAIN_BASE = 'mx-auto w-full min-w-0 px-5 pt-7';

/**
 * Moldura do app (Nav + conteúdo) já com a decisão tomada: `active` = passo do onboarding.
 * Separada do shell porque só ela é pura de roteador, então dá pra renderizar e testar sozinha.
 */
export function OnboardingFrame({
  active,
  step,
  nav,
  children,
  locale = 'pt-BR',
}: {
  active: boolean;
  step: number;
  nav: React.ReactNode;
  children: React.ReactNode;
  locale?: Locale;
}) {
  if (!active) {
    return (
      <div className="md:flex md:min-h-dvh">
        {nav}
        <main className={`${MAIN_BASE} max-w-[640px] pb-32 md:max-w-none md:flex-1 md:px-10 md:pt-9 md:pb-16`}>
          {children}
        </main>
      </div>
    );
  }

  const t = getDictionary(locale).growth.onboarding;
  const { step: current, total, percent } = onboardingProgress(step);
  return (
    <div data-onboarding="true" className="min-h-dvh">
      <main className={`${MAIN_BASE} max-w-[640px] pb-16 md:max-w-[960px] md:px-10 md:pt-9`}>
        <header className="mb-5 flex items-center gap-4">
          <div className="flex min-w-0 grow flex-col gap-1">
            <div
              role="progressbar"
              aria-label={t.progressAria(current, total)}
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={current}
              className="h-2 overflow-hidden rounded-full border border-linha bg-papel-2"
            >
              <div className="h-full rounded-full bg-tinta transition-all" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-xs font-semibold text-tinta-suave">{t.stepLabel(current, total)}</span>
          </div>
          <Link
            href="/inicio"
            className="flex h-10 shrink-0 items-center rounded-full border border-linha px-4 text-sm font-semibold text-tinta no-underline hover:bg-papel-2"
          >
            {t.later}
          </Link>
        </header>
        {children}
      </main>
    </div>
  );
}

/**
 * Casca do layout do app. Com `?novo=1` em /conectar ou /renda esconde a Nav completa e mostra só o progresso 1→2→3
 * e "Fazer depois"; em qualquer outra tela é o layout de sempre.
 */
export function OnboardingShell({
  nav,
  children,
  locale = 'pt-BR',
}: {
  nav: React.ReactNode;
  children: React.ReactNode;
  locale?: Locale;
}) {
  const pathname = usePathname();
  const novo = useSearchParams().get('novo');
  const active = isOnboardingActive(pathname, novo);
  return (
    <OnboardingFrame active={active} step={onboardingStep(pathname)} nav={nav} locale={locale}>
      {children}
    </OnboardingFrame>
  );
}

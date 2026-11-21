'use client';
import { useEffect, useState } from 'react';
import { getDictionary, type Locale } from '@/lib/i18n';
import {
  detectPlatform,
  isDismissed,
  isStandalone,
  PWA_DISMISS_KEY,
  shouldShowPwaBanner,
  type PwaBannerMode,
  type PwaPlatform,
} from '@/lib/pwa-install';

// Evento não-padrão do Chromium (não está no lib.dom do TypeScript).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function readDismissed(): string | null {
  try {
    return localStorage.getItem(PWA_DISMISS_KEY);
  } catch {
    return null; // modo privado / storage bloqueado: o convite só aparece de novo na próxima visita
  }
}

/** Convite dispensável pra instalar o Tostão: botão "Instalar" (Chrome/Android/Edge) ou guia do iOS Safari. */
export function PwaInstallBanner({ locale = 'pt-BR' }: { locale?: Locale }) {
  const t = getDictionary(locale).growth.pwa;
  const [mode, setMode] = useState<PwaBannerMode>(null);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const platform: PwaPlatform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
    const standalone = isStandalone({
      displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
      navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    });
    const dismissed = isDismissed(readDismissed(), Date.now());
    let captured: BeforeInstallPromptEvent | null = null;

    const evaluate = () =>
      setMode(shouldShowPwaBanner({ standalone, dismissed, platform, hasPrompt: captured !== null }));

    const onBeforeInstall = (event: Event) => {
      event.preventDefault(); // segura o mini-infobar do navegador: o convite é o nosso card
      captured = event as BeforeInstallPromptEvent;
      setPrompt(captured);
      evaluate();
    };
    const onInstalled = () => {
      captured = null;
      setPrompt(null);
      setMode(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    evaluate(); // iOS não dispara beforeinstallprompt: decide já na montagem
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(PWA_DISMISS_KEY, String(Date.now()));
    } catch {
      /* sem storage: só fecha agora */
    }
    setMode(null);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    setPrompt(null);
    if (outcome === 'accepted') setMode(null);
    else dismiss();
  };

  return (
    <section
      aria-label={mode === 'ios' ? t.iosTitle : t.title}
      className="relative flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5 pr-10"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.dismissAria}
        className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-tinta-suave hover:bg-papel-2"
      >
        <span aria-hidden="true">×</span>
      </button>
      {mode === 'prompt' ? (
        <>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-bold">{t.title}</h2>
            <p className="text-[13px] leading-[18px] text-tinta-suave">{t.body}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={install}
              className="h-10 rounded-full bg-tinta px-5 text-sm font-semibold text-papel"
            >
              {t.install}
            </button>
            <button type="button" onClick={dismiss} className="h-10 px-3 text-sm font-semibold text-tinta-suave">
              {t.dismiss}
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-[15px] font-bold">{t.iosTitle}</h2>
          <ol className="flex flex-col gap-1.5 text-[13px] leading-[18px] text-tinta">
            <li className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-azul" aria-hidden="true">
                {/* Ícone de Compartilhar do iOS: quadrado com seta pra cima */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 15V3M8 7l4-4 4 4" />
                  <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
                </svg>
              </span>
              {t.iosStep1}
            </li>
            <li className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amarelo-claro"
                aria-hidden="true"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="4" width="16" height="16" rx="3" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              </span>
              {t.iosStep2}
            </li>
            <li className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-menta-clara"
                aria-hidden="true"
              >
                ✓
              </span>
              {t.iosStep3}
            </li>
          </ol>
          <button type="button" onClick={dismiss} className="h-9 self-start text-sm font-semibold text-tinta-suave">
            {t.dismiss}
          </button>
        </>
      )}
    </section>
  );
}

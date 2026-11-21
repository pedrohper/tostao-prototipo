// Quando mostrar o convite pra instalar o Tostão como app. Tudo puro (recebe o que o navegador diz),
// então a regra de exibição é testável sem DOM.

export const PWA_DISMISS_KEY = 'tostao-pwa-banner';
/** Quem dispensa só volta a ver o convite depois disso. */
export const PWA_DISMISS_DAYS = 30;

export type PwaPlatform = 'ios-safari' | 'chromium' | 'other';
export type PwaBannerMode = 'prompt' | 'ios' | null;

/** iPhone/iPad no Safari de verdade. Outros navegadores do iOS (Chrome, Firefox...) levam "CriOS", "FxiOS"... */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): PwaPlatform {
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1); // iPadOS 13+
  if (isIos) {
    const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo/.test(userAgent);
    return otherBrowser ? 'other' : 'ios-safari';
  }
  return /Chrome|Chromium|Edg\//.test(userAgent) ? 'chromium' : 'other';
}

/** Já roda como app instalado? (`display-mode: standalone` no resto, `navigator.standalone` no iOS.) */
export function isStandalone(input: { displayModeStandalone: boolean; navigatorStandalone?: boolean }): boolean {
  return input.displayModeStandalone || input.navigatorStandalone === true;
}

/** `raw` é o que ficou no localStorage: timestamp (ms) de quando dispensou. */
export function isDismissed(raw: string | null | undefined, now: number): boolean {
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at) || at <= 0) return false;
  return now - at < PWA_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * - 'prompt': o navegador liberou o `beforeinstallprompt` (Chrome/Android/Edge/Desktop): botão "Instalar".
 * - 'ios': Safari do iPhone/iPad (não tem prompt): mini-guia "Compartilhar > Adicionar à Tela de Início".
 * - null: não mostra (já instalado, dispensado ou sem como instalar).
 */
export function shouldShowPwaBanner(input: {
  standalone: boolean;
  dismissed: boolean;
  platform: PwaPlatform;
  hasPrompt: boolean;
}): PwaBannerMode {
  if (input.standalone || input.dismissed) return null;
  if (input.hasPrompt) return 'prompt';
  if (input.platform === 'ios-safari') return 'ios';
  return null;
}

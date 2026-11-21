// T4.1 · quando mostrar o convite pra instalar o Tostão como app (Chrome/Android/Edge x iOS Safari x já instalado).
import { describe, expect, it } from 'vitest';
import { detectPlatform, isDismissed, isStandalone, PWA_DISMISS_DAYS, shouldShowPwaBanner } from './pwa-install';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1',
  iphoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15',
  ipadOsSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  desktopEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  desktopFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
};

describe('detectPlatform()', () => {
  it('iPhone no Safari é ios-safari', () => {
    expect(detectPlatform(UA.iphoneSafari)).toBe('ios-safari');
  });

  it('iPadOS 13+ se apresenta como Mac, mas tem tela de toque', () => {
    expect(detectPlatform(UA.ipadOsSafari, 5)).toBe('ios-safari');
  });

  it('Mac de verdade (sem toque) não é iOS', () => {
    expect(detectPlatform(UA.macSafari, 0)).toBe('other');
  });

  it('Chrome e Firefox do iOS não são "Safari": o guia de Compartilhar não vale lá', () => {
    expect(detectPlatform(UA.iphoneChrome)).toBe('other');
    expect(detectPlatform(UA.iphoneFirefox)).toBe('other');
  });

  it('Chrome/Edge (Android e desktop) são chromium; Firefox desktop é other', () => {
    expect(detectPlatform(UA.androidChrome)).toBe('chromium');
    expect(detectPlatform(UA.desktopEdge)).toBe('chromium');
    expect(detectPlatform(UA.desktopFirefox)).toBe('other');
  });
});

describe('isStandalone()', () => {
  it('display-mode standalone (Android/desktop) ou navigator.standalone (iOS)', () => {
    expect(isStandalone({ displayModeStandalone: true })).toBe(true);
    expect(isStandalone({ displayModeStandalone: false, navigatorStandalone: true })).toBe(true);
  });

  it('no navegador comum não é standalone', () => {
    expect(isStandalone({ displayModeStandalone: false })).toBe(false);
    expect(isStandalone({ displayModeStandalone: false, navigatorStandalone: false })).toBe(false);
  });
});

describe('isDismissed()', () => {
  const now = Date.UTC(2026, 10, 21);
  const day = 24 * 60 * 60 * 1000;

  it('nunca dispensou (ou valor corrompido): não está dispensado', () => {
    expect(isDismissed(null, now)).toBe(false);
    expect(isDismissed('', now)).toBe(false);
    expect(isDismissed('abc', now)).toBe(false);
    expect(isDismissed('-5', now)).toBe(false);
  });

  it('dispensado há pouco continua dispensado', () => {
    expect(isDismissed(String(now - day), now)).toBe(true);
  });

  it(`depois de ${PWA_DISMISS_DAYS} dias o convite pode voltar`, () => {
    expect(isDismissed(String(now - (PWA_DISMISS_DAYS - 1) * day), now)).toBe(true);
    expect(isDismissed(String(now - (PWA_DISMISS_DAYS + 1) * day), now)).toBe(false);
  });
});

describe('shouldShowPwaBanner()', () => {
  const base = { standalone: false, dismissed: false, platform: 'chromium' as const, hasPrompt: false };

  it('navegador elegível com beforeinstallprompt capturado: mostra o botão "Instalar"', () => {
    expect(shouldShowPwaBanner({ ...base, hasPrompt: true })).toBe('prompt');
  });

  it('chromium SEM o evento ainda (ou já instalado pelo navegador) não mostra nada', () => {
    expect(shouldShowPwaBanner(base)).toBeNull();
  });

  it('iOS Safari mostra o mini-guia (não existe prompt lá)', () => {
    expect(shouldShowPwaBanner({ ...base, platform: 'ios-safari' })).toBe('ios');
  });

  it('rodando como app instalado (standalone) o banner some, em qualquer plataforma', () => {
    expect(shouldShowPwaBanner({ ...base, standalone: true, hasPrompt: true })).toBeNull();
    expect(shouldShowPwaBanner({ ...base, standalone: true, platform: 'ios-safari' })).toBeNull();
  });

  it('dispensado some, em qualquer plataforma', () => {
    expect(shouldShowPwaBanner({ ...base, dismissed: true, hasPrompt: true })).toBeNull();
    expect(shouldShowPwaBanner({ ...base, dismissed: true, platform: 'ios-safari' })).toBeNull();
  });

  it('outros navegadores sem prompt (Firefox desktop, Chrome do iOS) não mostram nada', () => {
    expect(shouldShowPwaBanner({ ...base, platform: 'other' })).toBeNull();
  });
});

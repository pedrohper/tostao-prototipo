// T4.1 · o banner nunca aparece no servidor nem antes de o navegador dizer que dá pra instalar:
// a decisão (standalone / dispensado / iOS / prompt) é feita no efeito, a partir de lib/pwa-install.ts.
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PwaInstallBanner } from './pwa-install-banner';

describe('PwaInstallBanner', () => {
  it('no render inicial (SSR/hidratação) não mostra nada: evita hydration mismatch e flash do banner', () => {
    expect(renderToString(<PwaInstallBanner />)).toBe('');
    expect(renderToString(<PwaInstallBanner locale="en" />)).toBe('');
  });
});

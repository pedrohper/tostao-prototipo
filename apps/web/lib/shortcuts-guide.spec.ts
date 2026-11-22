import { describe, expect, it } from 'vitest';
import { shortcutWebhookBody } from '@tostao/contracts';
import { bodyTemplate, guideSteps, installLink, webhookUrl } from './shortcuts-guide';

describe('webhookUrl', () => {
  it('aponta pro BFF do site (o iPhone não fala com a API direto) e ignora barra no fim', () => {
    expect(webhookUrl('https://tostao.exemplo.com')).toBe('https://tostao.exemplo.com/api/webhooks/shortcuts');
    expect(webhookUrl('https://tostao.exemplo.com///')).toBe('https://tostao.exemplo.com/api/webhooks/shortcuts');
  });
});

describe('bodyTemplate', () => {
  it('é JSON válido e, trocando as variáveis mágicas por valores, passa no contrato do webhook', () => {
    for (const kind of ['apple_pay', 'ios_notification'] as const) {
      const body = JSON.parse(
        bodyTemplate(kind)
          .replace(/\[Valor\]/g, '45,90')
          .replace(/\[Comerciante\]/g, 'Padaria')
          .replace(/\[Entrada do atalho\]/g, 'Compra aprovada R$ 45,90 em PADARIA')
          .replace(/\[Data atual\]/g, '2026-11-22T10:00'),
      );
      expect(shortcutWebhookBody.safeParse(body).success).toBe(true);
      expect(body.source).toBe(kind);
    }
  });
});

describe('guideSteps', () => {
  it('são exatamente 3 passos por caminho, com título e texto', () => {
    for (const kind of ['apple_pay', 'ios_notification'] as const) {
      const steps = guideSteps(kind);
      expect(steps).toHaveLength(3);
      for (const s of steps) {
        expect(s.title.length).toBeGreaterThan(3);
        expect(s.body.length).toBeGreaterThan(20);
      }
    }
    expect(guideSteps('ios_notification')[1]!.body).toMatch(/iOS 27/);
  });
});

describe('installLink', () => {
  it('só aceita link de atalho do iCloud; qualquer outra coisa (ou nada) some', () => {
    expect(installLink('apple_pay', { SHORTCUT_APPLE_PAY_URL: 'https://www.icloud.com/shortcuts/abc123' })).toBe(
      'https://www.icloud.com/shortcuts/abc123',
    );
    expect(
      installLink('ios_notification', {
        SHORTCUT_NOTIFICATION_URL: 'https://www.icloud.com/shortcuts/xyz',
      }),
    ).toBe('https://www.icloud.com/shortcuts/xyz');
    expect(installLink('apple_pay', { SHORTCUT_APPLE_PAY_URL: 'https://malvado.example/shortcuts/abc' })).toBeNull();
    expect(installLink('apple_pay', { SHORTCUT_APPLE_PAY_URL: 'javascript:alert(1)' })).toBeNull();
    expect(installLink('apple_pay', {})).toBeNull();
  });
});

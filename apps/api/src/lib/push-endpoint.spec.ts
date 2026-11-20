import { describe, expect, it } from 'vitest';
import { pushSubscriptionBody } from '@tostao/contracts';
import { isAllowedPushEndpoint } from './push-endpoint.js';

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc123',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QGxyz',
    'https://api.push.apple.com/3/device/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
    'https://xyz.push.services.mozilla.com/wpush/v2/abc',
  ])('aceita %s', (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(true);
  });

  it.each([
    ['loopback', 'http://127.0.0.1:3334/push'],
    ['loopback https', 'https://127.0.0.1/push'],
    ['metadata da nuvem', 'http://169.254.169.254/latest/meta-data'],
    ['rede docker', 'http://172.18.0.5/push'],
    ['localhost', 'https://localhost/push'],
    ['host qualquer', 'https://evil.com/push'],
    ['sufixo sem ponto', 'https://evilpush.apple.com/x'],
    ['allowlist no subdomínio do atacante', 'https://fcm.googleapis.com.evil.com/x'],
    ['allowlist no path', 'https://evil.com/fcm.googleapis.com'],
    ['http mesmo em host válido', 'http://fcm.googleapis.com/fcm/send/abc'],
    ['porta customizada', 'https://fcm.googleapis.com:8443/fcm/send/abc'],
    ['credencial na URL', 'https://user:pass@fcm.googleapis.com/fcm/send/abc'],
    ['credencial que disfarça o host', 'https://fcm.googleapis.com@evil.com/x'],
    ['só o sufixo, sem subdomínio', 'https://.push.apple.com/x'],
    ['ftp', 'ftp://fcm.googleapis.com/x'],
    ['lixo', 'não é url'],
  ])('bloqueia %s', (_nome, url) => {
    expect(isAllowedPushEndpoint(url)).toBe(false);
  });
});

describe('pushSubscriptionBody (formato)', () => {
  const keys = { p256dh: 'B'.repeat(87).replace(/B/g, 'A'), auth: 'a'.repeat(22) };
  const ok = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys };

  it('aceita chaves base64url no tamanho normal', () => {
    expect(pushSubscriptionBody.safeParse(ok).success).toBe(true);
  });
  it('rejeita http, credencial e porta no endpoint', () => {
    for (const endpoint of [
      'http://fcm.googleapis.com/x',
      'https://u:p@fcm.googleapis.com/x',
      'https://fcm.googleapis.com:444/x',
    ]) {
      expect(pushSubscriptionBody.safeParse({ ...ok, endpoint }).success, endpoint).toBe(false);
    }
  });
  it('rejeita chaves fora de base64url ou com tamanho absurdo', () => {
    expect(pushSubscriptionBody.safeParse({ ...ok, keys: { ...keys, auth: 'a b!' + 'a'.repeat(20) } }).success).toBe(
      false,
    );
    expect(pushSubscriptionBody.safeParse({ ...ok, keys: { ...keys, p256dh: 'p' } }).success).toBe(false);
    expect(pushSubscriptionBody.safeParse({ ...ok, keys: { ...keys, auth: 'a'.repeat(200) } }).success).toBe(false);
  });
});

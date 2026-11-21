import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EmailDeliveryError,
  FakeEmailGateway,
  ResendEmailGateway,
  buildEmailVerificationMessage,
  buildPasswordResetMessage,
} from './email-gateway.js';

afterEach(() => vi.restoreAllMocks());

const reset = {
  to: 'ana@x.com',
  name: 'Ana Souza',
  resetUrl: 'https://tostao.test/redefinir-senha?token=abc',
  expiresInMinutes: 60,
};

describe('ResendEmailGateway', () => {
  it('POST em api.resend.com/emails com Bearer, from, to, subject, html e text, e timeout de 10 s', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response('{"id":"1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    await new ResendEmailGateway('re_chave', 'Tostão <oi@tostao.test>').sendPasswordReset(reset);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer re_chave');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ from: 'Tostão <oi@tostao.test>', to: ['ana@x.com'], subject: expect.any(String) });
    expect(body.html).toContain(reset.resetUrl);
    expect(body.text).toContain(reset.resetUrl);
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('resposta de erro vira EmailDeliveryError e o log não carrega destinatário nem link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"message":"domain not verified ana@x.com"}', { status: 403 })),
    );
    const logs: string[] = [];
    const gw = new ResendEmailGateway('k', 'f@x.com', 10_000, (m) => logs.push(m));
    await expect(gw.sendPasswordReset(reset)).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(logs.join(' ')).toContain('403');
    expect(logs.join(' ')).not.toMatch(/ana@x\.com|token=/);
  });

  it('timeout / rede fora → EmailDeliveryError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(Object.assign(new Error('x'), { name: 'TimeoutError' }))),
    );
    const logs: string[] = [];
    await expect(
      new ResendEmailGateway('k', 'f@x.com', 10_000, (m) => logs.push(m)).sendEmailVerification({
        to: 'a@x.com',
        name: 'A',
        verifyUrl: 'https://t/v?token=1',
        expiresInHours: 24,
      }),
    ).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(logs[0]).toContain('TimeoutError');
  });

  it('o HTML escapa o nome (sem injeção) e não usa só o nome inteiro', () => {
    const m = buildPasswordResetMessage({ ...reset, name: '<script>alert(1)</script> Ana' });
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
    expect(
      buildEmailVerificationMessage({
        to: 'a@x.com',
        name: 'Maria Clara',
        verifyUrl: 'https://t/v',
        expiresInHours: 24,
      }).text,
    ).toContain('Oi, Maria!');
  });
});

describe('FakeEmailGateway', () => {
  it('guarda o que "enviou" e avisa o callback (dev imprime o link)', async () => {
    const seen: string[] = [];
    const fake = new FakeEmailGateway((e) => seen.push(e.kind));
    await fake.sendPasswordReset(reset);
    await fake.sendEmailVerification({
      to: 'a@x.com',
      name: 'A',
      verifyUrl: 'https://t/v?token=1',
      expiresInHours: 24,
    });
    await fake.sendSecurityAlert({ to: 'a@x.com', name: 'A', event: 'password_changed', at: new Date() });
    expect(fake.sent.map((e) => e.kind)).toEqual(['password-reset', 'email-verification', 'security-alert']);
    expect(seen).toHaveLength(3);
  });
});

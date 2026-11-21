import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendNotification = vi.fn();
vi.mock('web-push', () => ({ default: { sendNotification: (...args: unknown[]) => sendNotification(...args) } }));

const { WebPushGateway } = await import('./push-gateway.js');

const sub = (endpoint: string) => ({ endpoint, userId: 'u1', p256dh: 'p', auth: 'a' });
const payload = { title: 't', body: 'b', url: '/inicio' };

describe('WebPushGateway', () => {
  beforeEach(() => sendNotification.mockReset());

  it('manda com timeout de 10 s, TTL de 1 h e VAPID por envio', async () => {
    sendNotification.mockResolvedValue({});
    const gw = new WebPushGateway('pub', 'priv', 'mailto:a@b.c');
    expect(await gw.send(sub('https://fcm.googleapis.com/fcm/send/abc'), payload)).toBe('ok');
    expect(sendNotification).toHaveBeenCalledOnce();
    expect(sendNotification.mock.calls[0]![2]).toMatchObject({
      timeout: 10_000,
      TTL: 3600,
      vapidDetails: { subject: 'mailto:a@b.c', publicKey: 'pub', privateKey: 'priv' },
    });
  });

  it('inscrição antiga com endpoint interno não faz request nenhum e é marcada pra apagar (SSRF)', async () => {
    const gw = new WebPushGateway('pub', 'priv', 'mailto:a@b.c');
    for (const endpoint of ['http://127.0.0.1:3334/x', 'http://169.254.169.254/x', 'https://evil.com/push']) {
      expect(await gw.send(sub(endpoint), payload), endpoint).toBe('gone');
    }
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('404/410 = gone; outro erro = error', async () => {
    const gw = new WebPushGateway('pub', 'priv', 'mailto:a@b.c');
    const url = 'https://updates.push.services.mozilla.com/wpush/v2/abc';
    sendNotification.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 410 }));
    expect(await gw.send(sub(url), payload)).toBe('gone');
    sendNotification.mockRejectedValueOnce(new Error('timeout'));
    expect(await gw.send(sub(url), payload)).toBe('error');
  });
});

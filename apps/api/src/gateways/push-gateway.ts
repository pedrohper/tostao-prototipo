import webpush from 'web-push';
import type { PushSub } from '../repositories/types.js';

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Manda aviso pro celular (Web Push). 'gone' = a inscrição morreu (app desinstalado, permissão tirada). */
export interface PushGateway {
  enabled: boolean;
  publicKey: string | null;
  send(sub: PushSub, payload: PushPayload): Promise<'ok' | 'gone' | 'error'>;
}

export class FakePushGateway implements PushGateway {
  enabled = true;
  publicKey = 'fake-public-key';
  sent: { endpoint: string; payload: PushPayload }[] = [];
  async send(sub: PushSub, payload: PushPayload) {
    this.sent.push({ endpoint: sub.endpoint, payload });
    return 'ok' as const;
  }
}

export class DisabledPushGateway implements PushGateway {
  enabled = false;
  publicKey = null;
  async send() { return 'error' as const; }
}

export class WebPushGateway implements PushGateway {
  enabled = true;
  constructor(public readonly publicKey: string, privateKey: string, subject: string) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }
  async send(sub: PushSub, payload: PushPayload) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 6 * 60 * 60 });
      return 'ok' as const;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone' as const;
      console.error('[push] falhou:', status, (err as Error).message);
      return 'error' as const;
    }
  }
}

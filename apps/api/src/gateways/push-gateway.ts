import webpush from 'web-push';
import type { PushSub } from '../repositories/types.js';
import { isAllowedPushEndpoint } from '../lib/push-endpoint.js';

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
  async send() {
    return 'error' as const;
  }
}

export class WebPushGateway implements PushGateway {
  enabled = true;
  constructor(
    public readonly publicKey: string,
    private readonly privateKey: string,
    private readonly subject: string,
  ) {}
  async send(sub: PushSub, payload: PushPayload) {
    // Defesa em profundidade: inscrição antiga no banco com endpoint fora da allowlist nunca recebe request (SSRF).
    // 'gone' faz quem chama apagar a inscrição.
    if (!isAllowedPushEndpoint(sub.endpoint)) {
      console.warn('[push] endpoint fora da allowlist, descartando inscrição');
      return 'gone' as const;
    }
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        {
          TTL: 3600,
          timeout: 10_000,
          // Por envio, em vez do setVapidDetails global (que muda estado do módulo).
          vapidDetails: { subject: this.subject, publicKey: this.publicKey, privateKey: this.privateKey },
        },
      );
      return 'ok' as const;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone' as const;
      console.error('[push] falhou:', status, (err as Error).message);
      return 'error' as const;
    }
  }
}

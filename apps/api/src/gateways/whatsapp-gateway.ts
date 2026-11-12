// Porta pro WhatsApp. Hoje: Cloud API oficial da Meta. Sem token, fica desligado (e os testes usam o Fake).
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WhatsAppGateway {
  readonly enabled: boolean;
  /** Número que aparece pra pessoa (só dígitos, com DDI), pro link wa.me. */
  readonly displayNumber: string | null;
  send(to: string, text: string): Promise<void>;
  /** Confere a assinatura X-Hub-Signature-256 que a Meta manda no webhook. */
  verifySignature(rawBody: string, header: string | undefined): boolean;
}

export class FakeWhatsAppGateway implements WhatsAppGateway {
  sent: { to: string; text: string }[] = [];
  constructor(readonly enabled = false, readonly displayNumber: string | null = null) {}
  async send(to: string, text: string) { this.sent.push({ to, text }); }
  verifySignature() { return true; }
}

export class CloudApiWhatsAppGateway implements WhatsAppGateway {
  readonly enabled = true;
  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
    private readonly appSecret: string,
    readonly displayNumber: string | null,
    private readonly graph = 'https://graph.facebook.com/v21.0',
  ) {}

  async send(to: string, text: string) {
    const res = await fetch(`${this.graph}/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 4000), preview_url: false } }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`WhatsApp respondeu ${res.status}`);
  }

  verifySignature(rawBody: string, header: string | undefined) {
    if (!header?.startsWith('sha256=')) return false;
    const expected = Buffer.from(createHmac('sha256', this.appSecret).update(rawBody).digest('hex'));
    const got = Buffer.from(header.slice(7));
    return expected.length === got.length && timingSafeEqual(expected, got);
  }
}

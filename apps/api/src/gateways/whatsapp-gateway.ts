// Porta pro WhatsApp. Dois jeitos: Cloud API oficial da Meta, ou o n8n do Pedro (API não oficial).
// Sem nenhum dos dois configurado, fica desligado (e os testes usam o Fake).
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WhatsAppMedia {
  bytes: Uint8Array;
  mimeType: string;
}

export interface AudioTranscriber {
  transcribe(bytes: Uint8Array, mimeType: string): Promise<string | null>;
}

export class DisabledAudioTranscriber implements AudioTranscriber {
  async transcribe() { return null; }
}

export class FakeAudioTranscriber implements AudioTranscriber {
  calls: { bytes: Uint8Array; mimeType: string }[] = [];
  constructor(public next: string | null = null) {}
  async transcribe(bytes: Uint8Array, mimeType: string) {
    this.calls.push({ bytes, mimeType });
    return this.next;
  }
}

export class WhisperAudioTranscriber implements AudioTranscriber {
  constructor(private readonly url: string) {}

  async transcribe(bytes: Uint8Array, mimeType: string): Promise<string | null> {
    const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('mpeg') ? 'mp3' : 'ogg';
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(bytes)], { type: mimeType }), `audio.${ext}`);
    form.append('language', 'pt');
    const res = await fetch(this.url, { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Whisper respondeu ${res.status}`);
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? '').trim();
    return text || null;
  }
}

export interface WhatsAppGateway {
  readonly enabled: boolean;
  /** Número que aparece pra pessoa (só dígitos, com DDI), pro link wa.me. */
  readonly displayNumber: string | null;
  send(to: string, text: string): Promise<void>;
  /** Confere a assinatura X-Hub-Signature-256 que a Meta manda no webhook. */
  verifySignature(rawBody: string, header: string | undefined): boolean;
  /** Baixa mídia recebida pelo webhook oficial da Meta (ex.: áudio para transcrever). */
  downloadMedia?(mediaId: string): Promise<WhatsAppMedia | null>;
}

export class FakeWhatsAppGateway implements WhatsAppGateway {
  sent: { to: string; text: string }[] = [];
  media = new Map<string, WhatsAppMedia>();
  constructor(readonly enabled = false, readonly displayNumber: string | null = null) {}
  async send(to: string, text: string) { this.sent.push({ to, text }); }
  verifySignature() { return true; }
  async downloadMedia(mediaId: string) { return this.media.get(mediaId) ?? null; }
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

  async downloadMedia(mediaId: string): Promise<WhatsAppMedia | null> {
    const metaRes = await fetch(`${this.graph}/${encodeURIComponent(mediaId)}`, {
      headers: { authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!metaRes.ok) throw new Error(`WhatsApp media meta respondeu ${metaRes.status}`);
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;
    const fileRes = await fetch(meta.url, {
      headers: { authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!fileRes.ok) throw new Error(`WhatsApp media download respondeu ${fileRes.status}`);
    return {
      bytes: new Uint8Array(await fileRes.arrayBuffer()),
      mimeType: meta.mime_type ?? fileRes.headers.get('content-type') ?? 'audio/ogg',
    };
  }

  verifySignature(rawBody: string, header: string | undefined) {
    if (!header?.startsWith('sha256=')) return false;
    const expected = Buffer.from(createHmac('sha256', this.appSecret).update(rawBody).digest('hex'));
    const got = Buffer.from(header.slice(7));
    return expected.length === got.length && timingSafeEqual(expected, got);
  }
}

/**
 * WhatsApp via n8n (API não oficial no meio).
 * Entrada: o n8n faz POST /whatsapp/n8n e recebe as respostas no próprio retorno (não precisa deste gateway).
 * Saída ativa (avisos que partem do Tostão): POST no webhook do n8n com { to, text }.
 * Nos dois sentidos vai o header X-Tostao-Secret com o mesmo segredo.
 */
export class N8nWhatsAppGateway implements WhatsAppGateway {
  readonly enabled = true;
  constructor(
    private readonly secret: string,
    private readonly sendUrl: string | null,
    readonly displayNumber: string | null,
  ) {}

  async send(to: string, text: string) {
    if (!this.sendUrl) throw new Error('Sem N8N_WHATSAPP_SEND_URL: não dá pra mandar mensagem por conta própria');
    const res = await fetch(this.sendUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tostao-secret': this.secret },
      body: JSON.stringify({ to, text: text.slice(0, 4000) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`n8n respondeu ${res.status}`);
  }

  /** O webhook da Meta não vale aqui. */
  verifySignature() { return false; }
}

/** Compara o segredo sem vazar tempo. Segredo vazio nunca confere. */
export function sameSecret(expected: string, got: string | undefined) {
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * APIs não oficiais mandam o remetente de vários jeitos: "5511999998888@s.whatsapp.net", "+55 11 99999-8888".
 * Devolve só os dígitos, ou null se for grupo/lista/canal (o Tostão só fala no privado).
 */
export function normalizeWhatsAppFrom(raw: string): string | null {
  const [user, domain] = raw.trim().split('@');
  if (domain && domain !== 's.whatsapp.net' && domain !== 'c.us' && domain !== 'lid') return null;
  const digits = (user ?? '').split(':')[0]!.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

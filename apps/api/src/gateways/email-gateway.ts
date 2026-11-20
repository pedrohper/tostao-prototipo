// E-mail transacional. O resto do app só conhece a interface EmailGateway:
// em produção vai pelo Resend, em dev/teste fica na memória (FakeEmailGateway).
import { AppError } from '../domain/errors.js';

export type PasswordResetEmail = { to: string; name: string; resetUrl: string; expiresInMinutes: number };
export type EmailVerificationEmail = { to: string; name: string; verifyUrl: string; expiresInHours: number };
export type SecurityAlertEmail = { to: string; name: string; event: 'password_changed'; at: Date };

export interface EmailGateway {
  sendPasswordReset(input: PasswordResetEmail): Promise<void>;
  sendEmailVerification(input: EmailVerificationEmail): Promise<void>;
  sendSecurityAlert(input: SecurityAlertEmail): Promise<void>;
}

export class EmailDeliveryError extends AppError {
  constructor() {
    super('Não consegui enviar o e-mail agora. Tenta de novo daqui a pouco.', 502);
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'tudo bem';

type Message = { to: string; subject: string; html: string; text: string };

function layout(greeting: string, paragraphs: string[], cta?: { label: string; url: string }, footer?: string) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:22px">${escapeHtml(p)}</p>`).join('');
  const button = cta
    ? `<p style="margin:22px 0"><a href="${escapeHtml(cta.url)}" style="background:#1E1B18;color:#FDFBF6;padding:13px 22px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p><p style="margin:0 0 14px;font-size:13px;color:#6b645c;word-break:break-all">Se o botão não abrir, copia este link: ${escapeHtml(cta.url)}</p>`
    : '';
  const small = footer
    ? `<p style="margin:18px 0 0;font-size:13px;color:#6b645c;line-height:19px">${escapeHtml(footer)}</p>`
    : '';
  return `<div style="background:#FDFBF6;padding:24px;font-family:Inter,Arial,sans-serif;color:#1E1B18;max-width:520px"><p style="margin:0 0 14px;font-size:20px;font-weight:800">Oi, ${escapeHtml(greeting)}!</p>${body}${button}${small}</div>`;
}

export function buildPasswordResetMessage(i: PasswordResetEmail): Message {
  const intro = 'Recebemos um pedido pra criar uma senha nova no Tostão.';
  const validity = `O link vale por ${i.expiresInMinutes} minutos e só funciona uma vez.`;
  const ignore = 'Se não foi você, ignora este e-mail: sua senha continua a mesma.';
  return {
    to: i.to,
    subject: 'Crie sua senha nova no Tostão',
    html: layout(firstName(i.name), [intro, validity], { label: 'Criar senha nova', url: i.resetUrl }, ignore),
    text: `Oi, ${firstName(i.name)}!\n\n${intro}\n${validity}\n\nCriar senha nova: ${i.resetUrl}\n\n${ignore}`,
  };
}

export function buildEmailVerificationMessage(i: EmailVerificationEmail): Message {
  const intro = 'Falta só confirmar que este e-mail é seu.';
  const validity = `O link vale por ${i.expiresInHours} horas.`;
  const ignore = 'Se você não criou conta no Tostão, pode ignorar este e-mail.';
  return {
    to: i.to,
    subject: 'Confirme seu e-mail no Tostão',
    html: layout(firstName(i.name), [intro, validity], { label: 'Confirmar meu e-mail', url: i.verifyUrl }, ignore),
    text: `Oi, ${firstName(i.name)}!\n\n${intro}\n${validity}\n\nConfirmar: ${i.verifyUrl}\n\n${ignore}`,
  };
}

export function buildSecurityAlertMessage(i: SecurityAlertEmail): Message {
  const when = i.at.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const intro = `A senha da sua conta no Tostão foi alterada em ${when} (horário de Brasília).`;
  const action =
    'Se foi você, não precisa fazer nada. Se não foi, peça uma senha nova em "Esqueci minha senha" agora mesmo.';
  return {
    to: i.to,
    subject: 'Sua senha do Tostão foi alterada',
    html: layout(firstName(i.name), [intro, action]),
    text: `Oi, ${firstName(i.name)}!\n\n${intro}\n${action}`,
  };
}

/** Resend (https://resend.com/docs/api-reference/emails/send-email). Só `fetch`, sem SDK. */
export class ResendEmailGateway implements EmailGateway {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly timeoutMs = 10_000,
    private readonly log: (msg: string) => void = (m) => console.error(m),
  ) {}

  private async send(message: Message): Promise<void> {
    let res: Response;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      // Nunca loga o destinatário nem o corpo (tem link com token).
      this.log(`[email] resend inacessível: ${(err as Error).name}`);
      throw new EmailDeliveryError();
    }
    if (!res.ok) {
      this.log(`[email] resend recusou o envio: HTTP ${res.status}`);
      throw new EmailDeliveryError();
    }
  }

  sendPasswordReset(input: PasswordResetEmail) {
    return this.send(buildPasswordResetMessage(input));
  }
  sendEmailVerification(input: EmailVerificationEmail) {
    return this.send(buildEmailVerificationMessage(input));
  }
  sendSecurityAlert(input: SecurityAlertEmail) {
    return this.send(buildSecurityAlertMessage(input));
  }
}

export type SentEmail =
  | { kind: 'password-reset'; to: string; url: string }
  | { kind: 'email-verification'; to: string; url: string }
  | { kind: 'security-alert'; to: string; event: SecurityAlertEmail['event'] };

/**
 * Dev e teste: guarda o que "enviou" em `sent` e, se receber `onSend`, mostra o link (no dev, imprime no console da API
 * pra você completar o fluxo). A API recusa subir em produção com este gateway: o link carrega o token.
 */
export class FakeEmailGateway implements EmailGateway {
  readonly sent: SentEmail[] = [];
  constructor(private readonly onSend?: (e: SentEmail) => void) {}

  private push(e: SentEmail) {
    this.sent.push(e);
    this.onSend?.(e);
  }
  async sendPasswordReset(i: PasswordResetEmail) {
    this.push({ kind: 'password-reset', to: i.to, url: i.resetUrl });
  }
  async sendEmailVerification(i: EmailVerificationEmail) {
    this.push({ kind: 'email-verification', to: i.to, url: i.verifyUrl });
  }
  async sendSecurityAlert(i: SecurityAlertEmail) {
    this.push({ kind: 'security-alert', to: i.to, event: i.event });
  }
}

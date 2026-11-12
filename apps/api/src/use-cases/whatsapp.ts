import { randomInt } from 'node:crypto';
import type { Repositories } from '../repositories/types.js';
import type { WhatsAppGateway } from '../gateways/whatsapp-gateway.js';
import { AppError } from '../domain/errors.js';
import type { AskTostaoUseCase } from './ask-tostao.js';

const CODE_TTL = 15 * 60 * 1000;

/** "5511987654321" -> "•••• 4321" */
export const maskPhone = (phone: string) => `•••• ${phone.slice(-4)}`;

/** No WhatsApp, **negrito** do markdown vira *negrito*. */
const toWhatsApp = (text: string) => text.replace(/\*\*(.+?)\*\*/g, '*$1*');

/** Status e vínculo do número, pela tela do app. */
export class WhatsAppLinkUseCase {
  constructor(private readonly repos: Pick<Repositories, 'whatsapp'>, private readonly wa: WhatsAppGateway, private readonly now: () => Date = () => new Date()) {}

  async status({ userId }: { userId: string }) {
    const link = await this.repos.whatsapp.get(userId);
    return { enabled: this.wa.enabled, number: this.wa.displayNumber, linkedPhone: link?.phone ? maskPhone(link.phone) : null };
  }

  /** Código de 6 dígitos que a pessoa manda pro número do Tostão. Vale 15 min. */
  async createCode({ userId }: { userId: string }) {
    if (!this.wa.enabled) throw new AppError('O WhatsApp do Tostão ainda não tá ligado.', 409);
    let code = '';
    for (let i = 0; i < 5; i++) {
      code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      if (!(await this.repos.whatsapp.findByCode(code))) break;
    }
    const expiresAt = new Date(this.now().getTime() + CODE_TTL);
    await this.repos.whatsapp.setCode(userId, code, expiresAt);
    return { code, expiresAt: expiresAt.toISOString(), number: this.wa.displayNumber };
  }

  async unlink({ userId }: { userId: string }) { await this.repos.whatsapp.unlink(userId); }
}

/**
 * Mensagem que chegou no número do Tostão.
 * - Código válido: liga o número à conta.
 * - Número já ligado: responde com o mesmo chat do app (mesmo contexto e mesmo limite por dia).
 * - Número desconhecido: explica como ligar. Nunca mostra dado de ninguém pra número não ligado.
 */
export class HandleWhatsAppMessageUseCase {
  private readonly seen = new Set<string>();

  constructor(
    private readonly repos: Pick<Repositories, 'whatsapp' | 'users'>,
    private readonly wa: WhatsAppGateway,
    private readonly ask: Pick<AskTostaoUseCase, 'execute'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ id, from, text }: { id: string; from: string; text: string }) {
    // A Meta reenvia quando demora: não responder duas vezes a mesma mensagem.
    if (this.seen.has(id)) return 'duplicada';
    this.seen.add(id);
    if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value!);

    const code = /\b(\d{6})\b/.exec(text)?.[1];
    if (code) {
      const link = await this.repos.whatsapp.findByCode(code);
      if (link?.codeExpiresAt && link.codeExpiresAt > this.now()) {
        await this.repos.whatsapp.link(link.userId, from, this.now());
        const user = await this.repos.users.findById(link.userId);
        await this.wa.send(from, `Fechou, ${user?.name?.split(' ')[0] ?? 'tamo junto'}! 🐷 Agora é só me perguntar por aqui: "quanto gastei com delivery?", "dá pra comprar um tênis de R$ 300?". Pra desligar, é no app em Perfil > WhatsApp.`);
        return 'ligado';
      }
    }

    const link = await this.repos.whatsapp.findByPhone(from);
    if (!link) {
      await this.wa.send(from, 'Oi! Eu sou o Tostão 🐷. Pra conversar comigo aqui, abre o app em Perfil > WhatsApp, gera um código e me manda. (Se mandou um código, ele pode ter vencido: gera outro.)');
      return 'desconhecido';
    }
    try {
      const r = await this.ask.execute({ userId: link.userId, message: text.slice(0, 1000), channel: 'whatsapp' });
      await this.wa.send(from, toWhatsApp(r.reply.content));
    } catch (e) {
      await this.wa.send(from, e instanceof AppError ? e.message : 'Travei aqui. Tenta de novo daqui a pouco.');
    }
    return 'respondido';
  }
}

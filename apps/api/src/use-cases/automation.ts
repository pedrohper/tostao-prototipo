import { createHash, randomBytes } from 'node:crypto';
import {
  AUTOMATION_TOKEN_LIMIT,
  type AutomationTokenDTO,
  type ShortcutWebhookBody,
  type ShortcutWebhookResponse,
} from '@tostao/contracts';
import type { AutomationToken } from '../domain/entities.js';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';
import { civilDay, noonOfCivilDay } from '../lib/tz.js';
import { timezoneOf } from '../lib/user-tz.js';
import type { Repositories } from '../repositories/types.js';
import { shortcutExternalId } from '../services/app-entries.js';
import { isManualAccount } from '../services/manual-balance.js';
import { parseShortcutPayload } from '../services/shortcut-payload.js';
import type { CreateManualTransactionUseCase } from './create-manual-transaction.js';

export const TOKEN_PREFIX = 'tst_';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Mensagem única pra token inexistente, errado ou revogado: quem ataca não descobre qual dos três. */
export class InvalidAutomationTokenError extends AppError {
  constructor() {
    super('Token inválido.', 401);
  }
}

const present = (t: AutomationToken): AutomationTokenDTO => ({
  id: t.id,
  label: t.label,
  lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
  revokedAt: t.revokedAt?.toISOString() ?? null,
  createdAt: t.createdAt.toISOString(),
});

/** Tokens de automação (Atalhos do iOS). O token em claro existe UMA vez, na resposta da criação: no banco só o SHA-256. */
export class AutomationTokensUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'automationTokens'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(userId: string) {
    return {
      tokens: (await this.repos.automationTokens.listByUser(userId)).map(present),
      limit: AUTOMATION_TOKEN_LIMIT,
    };
  }

  async create(userId: string, label: string) {
    // 32 bytes aleatórios (256 bits): impossível de adivinhar, então um hash rápido (SHA-256) basta (não é senha de gente).
    const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const item = await this.repos.automationTokens.createLimited(
      { userId, label, tokenHash: hashToken(token) },
      AUTOMATION_TOKEN_LIMIT,
    );
    if (!item)
      throw new AppError(
        `Você já tem ${AUTOMATION_TOKEN_LIMIT} atalhos ativos. Revogue um pra criar outro.`,
        409,
        'AUTOMATION_TOKEN_LIMIT',
      );
    return { token, item: present(item) };
  }

  async revoke(userId: string, id: string) {
    if (!(await this.repos.automationTokens.revoke(userId, id, this.now()))) throw new ResourceNotFoundError('Atalho');
  }

  /** `Authorization: Bearer tst_...` → o token (registro). Qualquer problema = o mesmo 401. */
  async authenticate(authorization: string | undefined): Promise<AutomationToken> {
    const m = /^Bearer (tst_[A-Za-z0-9_-]{20,100})$/.exec(authorization ?? '');
    if (!m) throw new InvalidAutomationTokenError();
    const found = await this.repos.automationTokens.findByHash(hashToken(m[1]!));
    if (!found || found.revokedAt) throw new InvalidAutomationTokenError();
    await this.repos.automationTokens.touch(found.id, this.now()).catch(() => undefined);
    return found;
  }
}

/** `POST /webhooks/shortcuts`: uma compra do Apple Pay / notificação do iPhone vira um lançamento. */
export class ShortcutWebhookUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users' | 'accounts' | 'transactions'>,
    private readonly createManual: CreateManualTransactionUseCase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(token: AutomationToken, body: ShortcutWebhookBody): Promise<ShortcutWebhookResponse> {
    const userId = token.userId;
    const parsed = parseShortcutPayload(body);
    if (!parsed) throw new AppError('Não achei o valor da compra. Mande `amount` ou um `text` com "R$ 0,00".', 400);

    // Idempotência: o Atalho reenvia (rede ruim, automação disparando 2x). Mesmo `eventId` = mesmo lançamento.
    const externalId = body.eventId ? shortcutExternalId(token.id, body.eventId) : undefined;
    if (externalId) {
      const dup = await this.repos.transactions.findByExternalId(userId, externalId);
      if (dup) return { id: dup.id, duplicate: true };
    }

    // Conta: só manual (ou nenhuma). Conta ligada ao banco já traz a compra sozinha, e a nossa ficaria em dobro.
    let accountId: string | null = null;
    if (body.accountId) {
      const account = (await this.repos.accounts.listByUser(userId)).find((a) => a.id === body.accountId);
      if (!account) throw new ResourceNotFoundError('Conta');
      if (!isManualAccount(account))
        throw new AppError('Essa conta é ligada ao banco e já traz as compras sozinha.', 400);
      accountId = account.id;
    }

    // Data: o DIA CIVIL da pessoa (fuso dela), meio-dia. Sem data (ou data inválida/futura demais), é hoje.
    const tz = await timezoneOf(this.repos.users, userId);
    const now = this.now();
    const today = civilDay(now, tz);
    let day = today;
    if (body.occurredAt) {
      const d = new Date(body.occurredAt);
      if (!Number.isNaN(d.getTime())) {
        const candidate = civilDay(d, tz);
        // Não aceita mais de 1 dia no futuro (relógio do telefone errado não agenda lançamento pro ano que vem).
        if (candidate <= civilDay(new Date(now.getTime() + 86_400_000), tz)) day = candidate;
      }
    }

    try {
      const { transaction } = await this.createManual.execute({
        userId,
        description: parsed.description,
        amountInCents: parsed.amountInCents,
        kind: parsed.kind,
        occurredAt: noonOfCivilDay(day, tz),
        accountId,
        ...(externalId ? { externalId } : {}),
        note: `Via Atalhos do iPhone (${body.source === 'apple_pay' ? 'Apple Pay' : body.source === 'ios_notification' ? 'notificação' : 'atalho'})`,
      });
      return { id: transaction.id, duplicate: false };
    } catch (err) {
      // Duas entregas ao mesmo tempo: a segunda bate no UNIQUE(userId, externalId). Devolve o que a primeira criou.
      if (externalId) {
        const dup = await this.repos.transactions.findByExternalId(userId, externalId);
        if (dup) return { id: dup.id, duplicate: true };
      }
      throw err;
    }
  }
}

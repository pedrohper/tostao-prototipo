// Ações que a IA PROPÕE e que só acontecem depois do "confirmar" da pessoa (human-in-the-loop).
// Ficam no KeyValueStore (Redis) por 5 minutos, uma por pessoa; confirmar/cancelar é de uso único (GETDEL).
import { randomBytes } from 'node:crypto';
import type { KeyValueStore } from '../lib/redis.js';
import type { ProposedTransaction } from '../use-cases/tostao-tools.js';

export const PENDING_TTL_SECONDS = 5 * 60;

export type PendingAction = ProposedTransaction & {
  id: string;
  kind: 'registrar_transacao';
  createdAt: string;
  expiresAt: string;
};

export class PendingActionStore {
  constructor(
    private readonly kv: KeyValueStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private key(userId: string) {
    return `ai:pending:${userId}`;
  }

  /** Uma proposta nova substitui a anterior (a pessoa só confirma a última que viu). */
  async propose(userId: string, proposal: ProposedTransaction): Promise<PendingAction> {
    const now = this.now();
    const action: PendingAction = {
      ...proposal,
      id: randomBytes(12).toString('base64url'),
      kind: 'registrar_transacao',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PENDING_TTL_SECONDS * 1000).toISOString(),
    };
    await this.kv.set(this.key(userId), JSON.stringify(action), PENDING_TTL_SECONDS);
    return action;
  }

  private parse(raw: string | null): PendingAction | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PendingAction;
    } catch {
      return null;
    }
  }

  /** Lê sem consumir (pra mostrar o que está pendente). */
  async peek(userId: string): Promise<PendingAction | null> {
    return this.parse(await this.kv.get(this.key(userId)));
  }

  /**
   * Pega e apaga numa operação só: duas confirmações simultâneas nunca gravam duas vezes.
   * Com `id`, só consome se for a proposta atual (id de proposta velha/forjado não consome nada).
   */
  async consume(userId: string, id?: string): Promise<PendingAction | null> {
    if (id !== undefined) {
      const current = await this.peek(userId);
      if (!current || current.id !== id) return null;
    }
    const taken = this.parse(await this.kv.getdel(this.key(userId)));
    if (!taken || (id !== undefined && taken.id !== id)) return null;
    return taken;
  }
}

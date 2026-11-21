import { randomBytes } from 'node:crypto';
import type { Repositories } from '../repositories/types.js';
import { AppError } from '../domain/errors.js';

const MAX_OPEN = 10;

/** Código curto e fácil de ditar: TOST-XXXX-XXXX (sem 0/O/1/I pra ninguém confundir). */
function newCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return `TOST-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** Quem já tem conta gera convite pra chamar alguém. */
export class CreateInviteUseCase {
  constructor(private readonly repos: Pick<Repositories, 'invites'>) {}

  async execute({ userId }: { userId: string }) {
    const mine = await this.repos.invites.listByCreator(userId);
    if (mine.filter((i) => !i.usedById).length >= MAX_OPEN)
      throw new AppError(`Você já tem ${MAX_OPEN} convites sem uso.`, 400);
    return { invite: await this.repos.invites.create({ code: newCode(), createdById: userId }) };
  }
}

export class ListInvitesUseCase {
  constructor(private readonly repos: Pick<Repositories, 'invites' | 'users'>) {}

  async execute({ userId }: { userId: string }) {
    const invites = await this.repos.invites.listByCreator(userId);
    // Quem usou, numa query só (antes uma por convite).
    const usedBy = new Map(
      (await this.repos.users.findManyByIds(invites.flatMap((i) => (i.usedById ? [i.usedById] : [])))).map((u) => [
        u.id,
        u.name,
      ]),
    );
    return {
      invites: invites.map((i) => ({
        code: i.code,
        createdAt: i.createdAt,
        usedAt: i.usedAt,
        usedBy: i.usedById ? (usedBy.get(i.usedById) ?? null) : null,
      })),
    };
  }
}

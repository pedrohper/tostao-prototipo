import type { UsersRepository } from '../repositories/types.js';
import { safeTimezone } from './tz.js';

/** Fuso da pessoa (User.timezone); sem usuário ou com fuso inválido, Brasília. */
export async function timezoneOf(users: Pick<UsersRepository, 'findById'>, userId: string): Promise<string> {
  return safeTimezone((await users.findById(userId))?.timezone);
}

import {
  applyHomePrefsPatch,
  readStoredHomePrefs,
  type HomePrefsPatch,
  type HomePrefsResponse,
} from '@tostao/contracts';
import { ResourceNotFoundError } from '../domain/errors.js';
import type { Repositories } from '../repositories/types.js';

/**
 * Preferências da Home da própria pessoa (T6.11), iguais no celular e no computador. O id vem sempre do token. A regra
 * de mistura (a conta vence um cookie antigo; aviso fechado não é personalização) mora nos contratos.
 */
export class HomePrefsUseCase {
  constructor(private readonly repos: Pick<Repositories, 'users'>) {}

  async get({ userId }: { userId: string }): Promise<HomePrefsResponse> {
    const user = await this.repos.users.findById(userId);
    if (!user) throw new ResourceNotFoundError('Conta');
    return { prefs: readStoredHomePrefs(user.homePrefs) };
  }

  async update({ userId, patch }: { userId: string; patch: HomePrefsPatch }): Promise<HomePrefsResponse> {
    const prefs = await this.repos.users.updateHomePrefs(userId, (current) =>
      applyHomePrefsPatch(readStoredHomePrefs(current), patch),
    );
    if (!prefs) throw new ResourceNotFoundError('Conta');
    return { prefs };
  }
}

import { pixKeyTypeOf, type PixKeyResponse } from '@tostao/contracts';
import { ResourceNotFoundError } from '../domain/errors.js';
import type { Repositories } from '../repositories/types.js';

/**
 * Chave Pix opcional da própria pessoa (usada pelo "Cobrar" dos acertos). O id vem sempre do token: não existe
 * parâmetro de usuário. A chave chega já normalizada pelo contrato (`pixKeyBody`) e não aparece em log nem auditoria.
 */
export class PixKeyUseCase {
  constructor(private readonly repos: Pick<Repositories, 'users'>) {}

  async get({ userId }: { userId: string }): Promise<PixKeyResponse> {
    const user = await this.repos.users.findById(userId);
    if (!user) throw new ResourceNotFoundError('Conta');
    return { pixKey: user.pixKey, type: user.pixKey ? pixKeyTypeOf(user.pixKey) : null };
  }

  /** null apaga a chave. */
  async set({ userId, pixKey }: { userId: string; pixKey: string | null }): Promise<PixKeyResponse> {
    await this.get({ userId }); // conta apagada com o token ainda válido: 404, não erro do banco
    await this.repos.users.setPixKey(userId, pixKey);
    return this.get({ userId });
  }
}

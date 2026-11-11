import type { BankConnectionsRepository, UsersRepository } from '../repositories/types.js';
import { ResourceNotFoundError } from '../domain/errors.js';

export class GetProfileUseCase {
  constructor(private readonly users: UsersRepository, private readonly connections: BankConnectionsRepository) {}

  async execute({ userId }: { userId: string }) {
    const user = await this.users.findById(userId);
    if (!user) throw new ResourceNotFoundError('Usuário');
    const connections = await this.connections.listByUser(userId);
    return { user, connections };
  }
}

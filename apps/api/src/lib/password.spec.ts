import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { InvalidCredentialsError } from '../domain/errors.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { AuthenticateUseCase } from '../use-cases/authenticate.js';
import {
  BCRYPT_COST,
  DUMMY_PASSWORD_HASH,
  burnPasswordCheck,
  hashPassword,
  needsRehash,
  verifyPassword,
} from './password.js';

describe('lib/password', () => {
  it('hash com custo 12 e verificação', async () => {
    const hash = await hashPassword('12345678');
    expect(hash).toMatch(/^\$2[ab]\$12\$/);
    expect(await verifyPassword('12345678', hash)).toBe(true);
    expect(await verifyPassword('87654321', hash)).toBe(false);
  });

  it('o hash de mentira tem o mesmo custo que o real (senão o tempo muda)', () => {
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(BCRYPT_COST);
  });

  it('senha acima de 72 bytes: hash lança, verificação nega (acentos contam em bytes)', async () => {
    const ok72 = 'a'.repeat(72);
    await expect(hashPassword(ok72)).resolves.toMatch(/^\$2/);
    await expect(hashPassword('a'.repeat(73))).rejects.toThrow(RangeError);
    const acentos = 'ç'.repeat(37); // 74 bytes
    await expect(hashPassword(acentos)).rejects.toThrow(RangeError);
    expect(await verifyPassword('a'.repeat(73), await hashPassword(ok72))).toBe(false);
  });

  it('needsRehash: custo antigo (10) precisa, custo atual não', async () => {
    expect(needsRehash(await bcrypt.hash('x12345678', 10))).toBe(true);
    expect(needsRehash(await hashPassword('x12345678'))).toBe(false);
    expect(needsRehash('lixo')).toBe(true);
  });
});

describe('AuthenticateUseCase', () => {
  it('hash antigo (custo 10) entra e é refeito com custo 12 no login', async () => {
    const repos = makeInMemoryRepositories();
    const user = await repos.users.create({
      name: 'P',
      email: 'p@x.com',
      passwordHash: await bcrypt.hash('12345678', 10),
    });
    await new AuthenticateUseCase(repos.users).execute({ email: 'p@x.com', password: '12345678' });
    const after = (await repos.users.findById(user.id))!.passwordHash!;
    expect(bcrypt.getRounds(after)).toBe(12);
    expect(await verifyPassword('12345678', after)).toBe(true);
  });

  it('senha errada não refaz o hash', async () => {
    const repos = makeInMemoryRepositories();
    const old = await bcrypt.hash('12345678', 10);
    const user = await repos.users.create({ name: 'P', email: 'p@x.com', passwordHash: old });
    await expect(
      new AuthenticateUseCase(repos.users).execute({ email: 'p@x.com', password: 'errada00' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect((await repos.users.findById(user.id))!.passwordHash).toBe(old);
  });

  it('e-mail inexistente e conta só social também rodam uma conferência bcrypt completa (tempo constante)', async () => {
    const repos = makeInMemoryRepositories();
    await repos.users.create({ name: 'Social', email: 's@x.com', passwordHash: null });
    await repos.users.create({ name: 'P', email: 'p@x.com', passwordHash: await hashPassword('12345678') });
    const auth = new AuthenticateUseCase(repos.users);
    const time = async (email: string) => {
      const t = performance.now();
      await auth.execute({ email, password: '12345678x' }).catch(() => undefined);
      return performance.now() - t;
    };
    await time('p@x.com'); // aquece
    const real = await time('p@x.com');
    const missing = await time('nao@x.com');
    const social = await time('s@x.com');
    // Antes do dummy o caminho "sem conta" respondia em ~0 ms. Agora precisa gastar o grosso do custo de um bcrypt real.
    expect(missing).toBeGreaterThan(real * 0.5);
    expect(social).toBeGreaterThan(real * 0.5);
    await expect(auth.execute({ email: 'nao@x.com', password: '12345678' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    await expect(auth.execute({ email: 's@x.com', password: '12345678' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('burnPasswordCheck sempre devolve false, até com senha gigante', async () => {
    expect(await burnPasswordCheck('qualquer')).toBe(false);
    expect(await burnPasswordCheck('x'.repeat(500))).toBe(false);
  });
});

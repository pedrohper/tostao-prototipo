import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import type { BankGateway } from '../gateways/bank-gateway.js';

describe('Apagar minha conta', () => {
  it('pede a senha, desliga o banco no provedor e apaga a pessoa', async () => {
    const repos = makeInMemoryRepositories();
    const bank: BankGateway = new FakeBankGateway();
    const deleted: string[] = [];
    bank.deleteItem = async (itemId: string) => { deleted.push(itemId); };
    const app = await buildApp({ repos, bank, jwtSecret: 'segredo-de-teste-123', webOrigin: '*' });

    const reg = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Pedro', email: 'p@x.com', password: '12345678' } });
    const auth = { authorization: `Bearer ${reg.json().token}` };
    await app.inject({ method: 'POST', url: '/connections', headers: auth, payload: { itemId: 'item-de-exemplo' } });

    const wrong = await app.inject({ method: 'POST', url: '/me/delete', headers: auth, payload: { password: 'errada' } });
    expect(wrong.statusCode).toBe(403);
    expect(await repos.users.count()).toBe(1);

    const ok = await app.inject({ method: 'POST', url: '/me/delete', headers: auth, payload: { password: '12345678' } });
    expect(ok.statusCode).toBe(204);
    expect(deleted).toEqual(['item-de-exemplo']);
    expect(await repos.users.count()).toBe(0);

    // O mesmo e-mail pode criar conta de novo do zero
    const again = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Pedro', email: 'p@x.com', password: '12345678' } });
    expect(again.statusCode).toBe(201);
  });
});

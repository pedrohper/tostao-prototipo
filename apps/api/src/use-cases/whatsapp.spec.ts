import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { buildApp } from '../app.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { CloudApiWhatsAppGateway, FakeWhatsAppGateway } from '../gateways/whatsapp-gateway.js';
import { FakeAiGateway } from '../gateways/ai-gateway.js';

const wait = () => new Promise((r) => setTimeout(r, 20));

async function setup() {
  const repos = makeInMemoryRepositories();
  const wa = new FakeWhatsAppGateway(true, '5511900000000');
  const ai = new FakeAiGateway();
  ai.next = 'Você gastou **R$ 120,00** com delivery.';
  const app = await buildApp({ repos, bank: new FakeBankGateway(), ai, whatsapp: wa, whatsappVerifyToken: 'verifica', jwtSecret: 'segredo-de-teste-123', webOrigin: '*' });
  const reg = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Pedro Henrique', email: 'p@x.com', password: '12345678' } });
  const auth = { authorization: `Bearer ${reg.json().token}` };
  const msg = (id: string, from: string, body: string) => app.inject({ method: 'POST', url: '/whatsapp/webhook', payload: { entry: [{ changes: [{ value: { messages: [{ id, from, type: 'text', text: { body } }] } }] }] } });
  return { app, wa, auth, msg };
}

describe('WhatsApp', () => {
  it('liga o número com o código e responde com o chat do Tostão', async () => {
    const { app, wa, auth, msg } = await setup();
    expect((await app.inject({ method: 'GET', url: '/whatsapp', headers: auth })).json()).toEqual({ enabled: true, number: '5511900000000', linkedPhone: null });

    await msg('m1', '5511988887777', 'quanto gastei?');
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/gera um código/); // número desconhecido não vê nada

    const { code } = (await app.inject({ method: 'POST', url: '/whatsapp/code', headers: auth })).json();
    await msg('m2', '5511988887777', `TOSTAO ${code}`);
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/^Fechou, Pedro/);
    expect((await app.inject({ method: 'GET', url: '/whatsapp', headers: auth })).json().linkedPhone).toBe('•••• 7777');

    await msg('m3', '5511988887777', 'quanto gastei com delivery?');
    await msg('m3', '5511988887777', 'quanto gastei com delivery?'); // reenvio da Meta
    await wait();
    expect(wa.sent.at(-1)!.text).toBe('Você gastou *R$ 120,00* com delivery.');
    expect(wa.sent.filter((s) => s.text.startsWith('Você gastou'))).toHaveLength(1);

    await app.inject({ method: 'DELETE', url: '/whatsapp', headers: auth });
    await msg('m4', '5511988887777', 'e agora?');
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/gera um código/);
  });

  it('verificação da Meta e assinatura do webhook', async () => {
    const { app } = await setup();
    const ok = await app.inject({ method: 'GET', url: '/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=42' });
    expect(ok.body).toBe('42');
    expect((await app.inject({ method: 'GET', url: '/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=42' })).statusCode).toBe(403);

    const real = new CloudApiWhatsAppGateway('t', 'id', 'segredo', null);
    const body = '{"entry":[]}';
    const sig = `sha256=${createHmac('sha256', 'segredo').update(body).digest('hex')}`;
    expect(real.verifySignature(body, sig)).toBe(true);
    expect(real.verifySignature(body + ' ', sig)).toBe(false);
    expect(real.verifySignature(body, undefined)).toBe(false);
  });

  it('desligado: sem código e webhook fechado', async () => {
    const app = await buildApp({ repos: makeInMemoryRepositories(), bank: new FakeBankGateway(), jwtSecret: 'segredo-de-teste-123', webOrigin: '*' });
    expect((await app.inject({ method: 'POST', url: '/whatsapp/webhook', payload: {} })).statusCode).toBe(404);
  });
});

import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { buildApp } from '../app.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { CloudApiWhatsAppGateway, FakeWhatsAppGateway, normalizeWhatsAppFrom } from '../gateways/whatsapp-gateway.js';
import { FakeAiGateway } from '../gateways/ai-gateway.js';
import { buildN8nBridge } from '../http/n8n-bridge.js';

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

  describe('via n8n', () => {
    const SECRET = 'segredo-do-n8n-1234';
    async function setupN8n() {
      const repos = makeInMemoryRepositories();
      const wa = new FakeWhatsAppGateway(true, '5511900000000');
      const ai = new FakeAiGateway();
      ai.next = 'Você gastou **R$ 120,00** com delivery.';
      const app = await buildApp({ repos, bank: new FakeBankGateway(), ai, whatsapp: wa, n8nWhatsAppSecret: SECRET, jwtSecret: 'segredo-de-teste-123', webOrigin: '*' });
      const reg = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Pedro Henrique', email: 'p@x.com', password: '12345678' } });
      const auth = { authorization: `Bearer ${reg.json().token}` };
      const send = (payload: object, secret = SECRET) => app.inject({ method: 'POST', url: '/whatsapp/n8n', headers: { 'x-tostao-secret': secret }, payload });
      return { app, wa, auth, send, repos };
    }

    async function linked() {
      const ctx = await setupN8n();
      const { code } = (await ctx.app.inject({ method: 'POST', url: '/whatsapp/code', headers: ctx.auth })).json();
      await ctx.send({ id: 'l1', from: '5511988887777', text: code });
      return ctx;
    }

    it('responde no retorno do POST, sem mandar nada pelo gateway', async () => {
      const { app, wa, auth, send } = await setupN8n();
      const jid = '5511988887777@s.whatsapp.net';
      expect((await send({ id: 'a1', from: jid, text: 'oi' })).json().replies[0]).toMatch(/gera um código/);

      const { code } = (await app.inject({ method: 'POST', url: '/whatsapp/code', headers: auth })).json();
      expect((await send({ id: 'a2', from: jid, text: code })).json().replies[0]).toMatch(/^Fechou, Pedro/);
      expect((await app.inject({ method: 'GET', url: '/whatsapp', headers: auth })).json().linkedPhone).toBe('•••• 7777');

      expect((await send({ id: 'a3', from: jid, text: 'quanto gastei com delivery?' })).json()).toEqual({ replies: ['Você gastou *R$ 120,00* com delivery.'] });
      expect((await send({ id: 'a3', from: jid, text: 'quanto gastei com delivery?' })).json()).toEqual({ replies: [] }); // repetida
      expect(wa.sent).toHaveLength(0);
    });

    it('ignora grupo, mensagem própria e texto vazio; barra segredo errado', async () => {
      const { send } = await setupN8n();
      expect((await send({ from: '1203630@g.us', text: 'oi' })).json()).toEqual({ replies: [] });
      expect((await send({ from: '5511988887777', text: 'oi', fromMe: true })).json()).toEqual({ replies: [] });
      expect((await send({ from: '5511988887777', text: '  ' })).json()).toEqual({ replies: [] });
      expect((await send({ from: '5511988887777', text: 'oi' }, 'errado')).statusCode).toBe(401);
    });

    it('sem segredo configurado, a rota nem existe', async () => {
      const app = await buildApp({ repos: makeInMemoryRepositories(), bank: new FakeBankGateway(), jwtSecret: 'segredo-de-teste-123', webOrigin: '*' });
      expect((await app.inject({ method: 'POST', url: '/whatsapp/n8n', headers: { 'x-tostao-secret': '' }, payload: {} })).statusCode).toBe(404);
    });

    it('normaliza o remetente', () => {
      expect(normalizeWhatsAppFrom('5511988887777@s.whatsapp.net')).toBe('5511988887777');
      expect(normalizeWhatsAppFrom('5511988887777:12@s.whatsapp.net')).toBe('5511988887777');
      expect(normalizeWhatsAppFrom('+55 (11) 98888-7777')).toBe('5511988887777');
      expect(normalizeWhatsAppFrom('120363000@g.us')).toBeNull();
      expect(normalizeWhatsAppFrom('123')).toBeNull();
    });

    it('"gastei 25 no ifood" anota na hora, sem gastar pergunta da IA', async () => {
      const { send, repos } = await linked();
      const r = (await send({ id: 'g1', from: '5511988887777', text: 'gastei 25,90 no ifood' })).json();
      expect(r.replies[0]).toMatch(/^Anotado! .*Saiu \*R\$\s?25,90\*: Ifood/);
      const user = (await repos.users.findByEmail('p@x.com'))!;
      const txs = await repos.transactions.findManyInRange(user.id, new Date(Date.now() - 2 * 86_400_000), new Date(Date.now() + 86_400_000));
      expect(txs.some((t) => t.amountInCents === -2590 && t.description === 'Ifood')).toBe(true);
      expect((await send({ id: 'g2', from: '5511988887777', text: 'recebi 100 do pai' })).json().replies[0]).toMatch(/Entrou/);
    });

    it('aceita o webhook cru da Evolution API', async () => {
      const { send } = await linked();
      const evo = (key: object, message: object, event = 'messages.upsert') => ({ event, instance: 'bot-pessoal', data: { key, message } });
      expect((await send(evo({ id: 'e1', remoteJid: '5511988887777@s.whatsapp.net', fromMe: false }, { conversation: 'quanto gastei?' }))).json().replies[0]).toMatch(/Você gastou/);
      expect((await send(evo({ id: 'e2', remoteJid: '999@lid', remoteJidAlt: '5511988887777@s.whatsapp.net' }, { extendedTextMessage: { text: 'gastei 10 de pão' } }))).json().replies[0]).toMatch(/Anotado/);
      expect((await send(evo({ id: 'e3', remoteJid: '5511988887777@s.whatsapp.net', fromMe: true }, { conversation: 'oi' }))).json()).toEqual({ replies: [] });
      expect((await send(evo({ id: 'e4', remoteJid: '5511988887777@s.whatsapp.net' }, { conversation: 'oi' }, 'messages.update'))).json()).toEqual({ replies: [] });
    });

    it('a porta da ponte só repassa a rota do n8n', async () => {
      const { app } = await linked();
      const bridge = buildN8nBridge(app);
      const ok = await bridge.inject({ method: 'POST', url: '/whatsapp/n8n', headers: { 'x-tostao-secret': SECRET }, payload: { id: 'b1', from: '5511988887777', text: 'gastei 5 de bala' } });
      expect(ok.json().replies[0]).toMatch(/Anotado/);
      expect((await bridge.inject({ method: 'POST', url: '/whatsapp/n8n', payload: { from: '5511988887777', text: 'oi' } })).statusCode).toBe(401);
      expect((await bridge.inject({ method: 'GET', url: '/whatsapp' })).statusCode).toBe(404);
    });
  });
});

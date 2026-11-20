import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { buildApp } from '../app.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import {
  CloudApiWhatsAppGateway,
  FakeAudioTranscriber,
  FakeWhatsAppGateway,
  isOfficialMetaMediaUrl,
  MAX_MEDIA_BYTES,
  normalizeWhatsAppFrom,
  sameSecret,
} from '../gateways/whatsapp-gateway.js';
import { MemoryKeyValueStore } from '../lib/redis.js';
import { generateLinkCode, hashLinkCode, HandleWhatsAppMessageUseCase, WhatsAppLinkUseCase } from './whatsapp.js';
import { FakeAiGateway } from '../gateways/ai-gateway.js';
import { buildN8nBridge } from '../http/n8n-bridge.js';

const wait = () => new Promise((r) => setTimeout(r, 20));

async function setup() {
  const repos = makeInMemoryRepositories();
  const wa = new FakeWhatsAppGateway(true, '5511900000000');
  const ai = new FakeAiGateway();
  const transcriber = new FakeAudioTranscriber();
  ai.next = 'Você gastou **R$ 120,00** com delivery.';
  const app = await buildApp({
    repos,
    bank: new FakeBankGateway(),
    ai,
    whatsapp: wa,
    audioTranscriber: transcriber,
    whatsappVerifyToken: 'verifica',
    jwtSecret: 'segredo-de-teste-123',
    webOrigin: '*',
  });
  const reg = await app.inject({
    method: 'POST',
    url: '/users',
    payload: { name: 'Pedro Henrique', email: 'p@x.com', password: '12345678', acceptedTerms: true },
  });
  const auth = { authorization: `Bearer ${reg.json().accessToken}` };
  // A IA só responde depois do aceite LGPD (PATCH /me/consents).
  await app.inject({ method: 'PATCH', url: '/me/consents', headers: auth, payload: { aiConsent: true } });
  const msg = (id: string, from: string, body: string) =>
    app.inject({
      method: 'POST',
      url: '/whatsapp/webhook',
      payload: { entry: [{ changes: [{ value: { messages: [{ id, from, type: 'text', text: { body } }] } }] }] },
    });
  return { app, repos, wa, auth, msg, transcriber, ai };
}

describe('WhatsApp', () => {
  it('liga o número com o código e responde com o chat do Tostão', async () => {
    const { app, wa, auth, msg } = await setup();
    expect((await app.inject({ method: 'GET', url: '/whatsapp', headers: auth })).json()).toEqual({
      enabled: true,
      number: '5511900000000',
      linkedPhone: null,
    });

    await msg('m1', '5511988887777', 'quanto gastei?');
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/gera um código/); // número desconhecido não vê nada

    const { code } = (await app.inject({ method: 'POST', url: '/whatsapp/code', headers: auth })).json();
    await msg('m2', '5511988887777', `VINCULAR ${code}`);
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

  it('IA sem consentimento LGPD: pede o aceite no app e não chama a IA nem gasta pergunta', async () => {
    const { app, wa, auth, msg, ai } = await setup();
    const { code } = (await app.inject({ method: 'POST', url: '/whatsapp/code', headers: auth })).json();
    await msg('c1', '5511988887777', `VINCULAR ${code}`);
    await app.inject({ method: 'PATCH', url: '/me/consents', headers: auth, payload: { aiConsent: false } });

    await msg('c2', '5511988887777', 'quanto gastei com delivery?');
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/aceita o aviso de uso de IA/);
    expect(ai.calls).toHaveLength(0);
    expect(wa.sent.at(-1)!.text).not.toMatch(/Você gastou/);
  });

  describe('confirmação do que a IA propõe (SIM / NÃO)', () => {
    const toolCall = (args: Record<string, unknown>) => ({
      content: null,
      toolCalls: [
        {
          id: 'k1',
          type: 'function' as const,
          function: { name: 'registrar_transacao', arguments: JSON.stringify(args) },
        },
      ],
    });
    async function linkedUser() {
      const ctx = await setup();
      const { code } = (await ctx.app.inject({ method: 'POST', url: '/whatsapp/code', headers: ctx.auth })).json();
      await ctx.msg('l1', '5511988887777', `VINCULAR ${code}`);
      const userId = (await ctx.repos.users.findByEmail('p@x.com'))!.id;
      const count = async () =>
        (await ctx.repos.transactions.findManyInRange(userId, new Date(0), new Date(Date.now() + 86_400_000))).filter(
          (t) => t.description === 'Pizza',
        ).length;
      return { ...ctx, count };
    }

    it('a IA propõe, o WhatsApp pede SIM e só então grava (uma vez)', async () => {
      const { wa, msg, ai, count } = await linkedUser();
      ai.queue.push(toolCall({ descricao: 'Pizza', valor_reais: 50, tipo: 'saida' }), {
        content: 'Lanço a Pizza de R$ 50,00?',
        toolCalls: [],
      });
      await msg('s1', '5511988887777', 'quero lançar uma pizza de cinquenta');
      await wait();
      expect(wa.sent.at(-1)!.text).toMatch(/Responda \*SIM\* pra confirmar/);
      expect(await count()).toBe(0); // nada gravado ainda

      await msg('s2', '5511988887777', 'SIM');
      await wait();
      expect(wa.sent.at(-1)!.text).toMatch(/Anotado: Pizza/);
      expect(await count()).toBe(1);

      await msg('s3', '5511988887777', 'sim'); // não há mais nada pendente: vira pergunta normal
      await wait();
      expect(wa.sent.at(-1)!.text).not.toMatch(/Anotado/);
      expect(await count()).toBe(1);
    });

    it('NÃO cancela e um SIM depois não grava', async () => {
      const { wa, msg, ai, count } = await linkedUser();
      ai.queue.push(toolCall({ descricao: 'Pizza', valor_reais: 50, tipo: 'saida' }), {
        content: 'Confirma?',
        toolCalls: [],
      });
      await msg('n1', '5511988887777', 'quero lançar uma pizza de cinquenta');
      await msg('n2', '5511988887777', 'não');
      await wait();
      expect(wa.sent.at(-1)!.text).toMatch(/não anotei nada/i);
      await msg('n3', '5511988887777', 'sim');
      await wait();
      expect(wa.sent.at(-1)!.text).not.toMatch(/Anotado/);
      expect(await count()).toBe(0);
    });

    it('"SIM" de um número NÃO vinculado nunca confirma nada', async () => {
      const { wa, msg, ai, count } = await linkedUser();
      ai.queue.push(toolCall({ descricao: 'Pizza', valor_reais: 50, tipo: 'saida' }), {
        content: 'Confirma?',
        toolCalls: [],
      });
      await msg('x1', '5511988887777', 'quero lançar uma pizza de cinquenta');
      await msg('x2', '5511977776666', 'SIM'); // outro número
      await wait();
      expect(wa.sent.at(-1)!.text).toMatch(/gera um código/);
      expect(await count()).toBe(0);
    });
  });

  it('transcreve áudio do webhook oficial da Meta e executa como mensagem', async () => {
    const { app, wa, auth, msg, transcriber } = await setup();
    const { code } = (await app.inject({ method: 'POST', url: '/whatsapp/code', headers: auth })).json();
    await msg('m-link', '5511988887777', `VINCULAR ${code}`);
    await wait();

    transcriber.next = 'gastei 30 no uber';
    wa.media.set('media-audio-1', { bytes: new Uint8Array([1, 2, 3]), mimeType: 'audio/ogg; codecs=opus' });
    const res = await app.inject({
      method: 'POST',
      url: '/whatsapp/webhook',
      payload: {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'm-audio-1',
                      from: '5511988887777',
                      type: 'audio',
                      audio: { id: 'media-audio-1', mime_type: 'audio/ogg' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    await wait();

    expect(transcriber.calls).toHaveLength(1);
    expect(transcriber.calls[0]!.mimeType).toBe('audio/ogg; codecs=opus');
    expect(wa.sent.at(-1)!.text).toMatch(/^Anotado! .*Saiu \*R\$\s?30,00\*: Uber/);

    const sentCount = wa.sent.length;
    transcriber.next = null;
    wa.media.set('media-audio-2', { bytes: new Uint8Array([4, 5]), mimeType: 'audio/ogg' });
    await app.inject({
      method: 'POST',
      url: '/whatsapp/webhook',
      payload: {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [{ id: 'm-audio-2', from: '5511988887777', type: 'audio', audio: { id: 'media-audio-2' } }],
                },
              },
            ],
          },
        ],
      },
    });
    await wait();
    expect(wa.sent).toHaveLength(sentCount);
  });

  it('verificação da Meta e assinatura do webhook', async () => {
    const { app } = await setup();
    const ok = await app.inject({
      method: 'GET',
      url: '/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=42',
    });
    expect(ok.body).toBe('42');
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=42',
        })
      ).statusCode,
    ).toBe(403);

    const real = new CloudApiWhatsAppGateway('t', 'id', 'segredo', null);
    const body = '{"entry":[]}';
    const sig = `sha256=${createHmac('sha256', 'segredo').update(body).digest('hex')}`;
    expect(real.verifySignature(body, sig)).toBe(true);
    expect(real.verifySignature(body + ' ', sig)).toBe(false);
    expect(real.verifySignature(body, undefined)).toBe(false);
  });

  it('desligado: sem código e webhook fechado', async () => {
    const app = await buildApp({
      repos: makeInMemoryRepositories(),
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-123',
      webOrigin: '*',
    });
    expect((await app.inject({ method: 'POST', url: '/whatsapp/webhook', payload: {} })).statusCode).toBe(404);
  });

  describe('via n8n', () => {
    const SECRET = 'segredo-do-n8n-1234';
    async function setupN8n() {
      const repos = makeInMemoryRepositories();
      const wa = new FakeWhatsAppGateway(true, '5511900000000');
      const ai = new FakeAiGateway();
      ai.next = 'Você gastou **R$ 120,00** com delivery.';
      const app = await buildApp({
        repos,
        bank: new FakeBankGateway(),
        ai,
        whatsapp: wa,
        n8nWhatsAppSecret: SECRET,
        jwtSecret: 'segredo-de-teste-123',
        webOrigin: '*',
      });
      const reg = await app.inject({
        method: 'POST',
        url: '/users',
        payload: { name: 'Pedro Henrique', email: 'p@x.com', password: '12345678', acceptedTerms: true },
      });
      const auth = { authorization: `Bearer ${reg.json().accessToken}` };
      await app.inject({ method: 'PATCH', url: '/me/consents', headers: auth, payload: { aiConsent: true } });
      // A rota do n8n só existe na ponte isolada, não no app principal.
      const bridge = buildN8nBridge(app);
      const send = (payload: object, secret = SECRET) =>
        bridge.inject({ method: 'POST', url: '/whatsapp/n8n', headers: { 'x-tostao-secret': secret }, payload });
      return { app, bridge, wa, auth, send, repos };
    }

    async function linked() {
      const ctx = await setupN8n();
      const { code } = (await ctx.app.inject({ method: 'POST', url: '/whatsapp/code', headers: ctx.auth })).json();
      await ctx.send({ id: 'l1', from: '5511988887777', text: `VINCULAR ${code}` });
      return ctx;
    }

    it('responde no retorno do POST, sem mandar nada pelo gateway', async () => {
      const { app, wa, auth, send } = await setupN8n();
      const jid = '5511988887777@s.whatsapp.net';
      expect((await send({ id: 'a1', from: jid, text: 'oi' })).json().replies[0]).toMatch(/gera um código/);

      const { code } = (await app.inject({ method: 'POST', url: '/whatsapp/code', headers: auth })).json();
      expect((await send({ id: 'a2', from: jid, text: `VINCULAR ${code}` })).json().replies[0]).toMatch(
        /^Fechou, Pedro/,
      );
      expect((await app.inject({ method: 'GET', url: '/whatsapp', headers: auth })).json().linkedPhone).toBe(
        '•••• 7777',
      );

      expect((await send({ id: 'a3', from: jid, text: 'quanto gastei com delivery?' })).json()).toEqual({
        replies: ['Você gastou *R$ 120,00* com delivery.'],
      });
      expect((await send({ id: 'a3', from: jid, text: 'quanto gastei com delivery?' })).json()).toEqual({
        replies: [],
      }); // repetida
      expect(wa.sent).toHaveLength(0);
    });

    it('ignora grupo, mensagem própria e texto vazio; barra segredo errado', async () => {
      const { send } = await setupN8n();
      expect((await send({ from: '1203630@g.us', text: 'oi' })).json()).toEqual({ replies: [] });
      expect((await send({ from: '5511988887777', text: 'oi', fromMe: true })).json()).toEqual({ replies: [] });
      expect((await send({ from: '5511988887777', text: '  ' })).json()).toEqual({ replies: [] });
      expect((await send({ from: '5511988887777', text: 'oi' }, 'errado')).statusCode).toBe(401);
    });

    it('sem segredo configurado, a rota nem existe (nem na ponte)', async () => {
      const app = await buildApp({
        repos: makeInMemoryRepositories(),
        bank: new FakeBankGateway(),
        jwtSecret: 'segredo-de-teste-123',
        webOrigin: '*',
      });
      const bridge = buildN8nBridge(app);
      expect(
        (await bridge.inject({ method: 'POST', url: '/whatsapp/n8n', headers: { 'x-tostao-secret': '' }, payload: {} }))
          .statusCode,
      ).toBe(404);
    });

    it('o app principal NÃO expõe /whatsapp/n8n, nem com o segredo certo', async () => {
      const { app } = await setupN8n();
      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp/n8n',
        headers: { 'x-tostao-secret': SECRET },
        payload: { id: 'x', from: '5511988887777', text: 'oi' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('valida o corpo: texto acima de 4096 caracteres é recusado, e lixo não vira 500', async () => {
      const { send } = await setupN8n();
      expect((await send({ id: 'big', from: '5511988887777', text: 'a'.repeat(4097) })).statusCode).toBe(400);
      expect((await send({ id: 1, from: '5511988887777', text: 'oi' })).statusCode).toBe(400);
      expect((await send({ id: 'x', from: { a: 1 }, text: 'oi' })).statusCode).toBe(400);
      const evoLixo = { event: 'messages.upsert', data: { key: { id: 'k', remoteJid: 123 }, message: {} } };
      expect((await send(evoLixo)).statusCode).toBeLessThan(500);
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
      const txs = await repos.transactions.findManyInRange(
        user.id,
        new Date(Date.now() - 2 * 86_400_000),
        new Date(Date.now() + 86_400_000),
      );
      expect(txs.some((t) => t.amountInCents === -2590 && t.description === 'Ifood')).toBe(true);
      expect((await send({ id: 'g2', from: '5511988887777', text: 'recebi 100 do pai' })).json().replies[0]).toMatch(
        /Entrou/,
      );
    });

    it('aceita o webhook cru da Evolution API', async () => {
      const { send } = await linked();
      const evo = (key: object, message: object, event = 'messages.upsert') => ({
        event,
        instance: 'bot-pessoal',
        data: { key, message },
      });
      expect(
        (
          await send(
            evo(
              { id: 'e1', remoteJid: '5511988887777@s.whatsapp.net', fromMe: false },
              { conversation: 'quanto gastei?' },
            ),
          )
        ).json().replies[0],
      ).toMatch(/Você gastou/);
      expect(
        (
          await send(
            evo(
              { id: 'e2', remoteJid: '999@lid', remoteJidAlt: '5511988887777@s.whatsapp.net' },
              { extendedTextMessage: { text: 'gastei 10 de pão' } },
            ),
          )
        ).json().replies[0],
      ).toMatch(/Anotado/);
      expect(
        (
          await send(evo({ id: 'e3', remoteJid: '5511988887777@s.whatsapp.net', fromMe: true }, { conversation: 'oi' }))
        ).json(),
      ).toEqual({ replies: [] });
      expect(
        (
          await send(
            evo({ id: 'e4', remoteJid: '5511988887777@s.whatsapp.net' }, { conversation: 'oi' }, 'messages.update'),
          )
        ).json(),
      ).toEqual({ replies: [] });
    });

    it('a porta da ponte só repassa a rota do n8n', async () => {
      const { app } = await linked();
      const bridge = buildN8nBridge(app);
      const ok = await bridge.inject({
        method: 'POST',
        url: '/whatsapp/n8n',
        headers: { 'x-tostao-secret': SECRET },
        payload: { id: 'b1', from: '5511988887777', text: 'gastei 5 de bala' },
      });
      expect(ok.json().replies[0]).toMatch(/Anotado/);
      expect(
        (await bridge.inject({ method: 'POST', url: '/whatsapp/n8n', payload: { from: '5511988887777', text: 'oi' } }))
          .statusCode,
      ).toBe(401);
      expect((await bridge.inject({ method: 'GET', url: '/whatsapp' })).statusCode).toBe(404);
    });
  });
});

// ---------- T0.4: vínculo seguro do WhatsApp ----------
const PHONE_A = '5511988887777';
const PHONE_B = '5521977776666';

describe('vínculo seguro do número (VINCULAR + código forte)', () => {
  const newCode = async (app: Awaited<ReturnType<typeof setup>>['app'], auth: { authorization: string }) =>
    (await app.inject({ method: 'POST', url: '/whatsapp/code', headers: auth })).json().code as string;
  const linkedPhone = async (app: Awaited<ReturnType<typeof setup>>['app'], auth: { authorization: string }) =>
    (await app.inject({ method: 'GET', url: '/whatsapp', headers: auth })).json().linkedPhone as string | null;
  const registerB = async (app: Awaited<ReturnType<typeof setup>>['app']) => {
    const reg = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Bia Souza', email: 'bia@x.com', password: '12345678', acceptedTerms: true },
    });
    return { authorization: `Bearer ${reg.json().accessToken}` };
  };

  it('mensagem comum com 6 dígitos (ou só o código, sem VINCULAR) NÃO vincula', async () => {
    const { app, wa, auth, msg } = await setup();
    const code = await newCode(app, auth);
    const tries = [
      '123456',
      'meu código é 654321',
      'TOSTAO 123456',
      code,
      `me vincula ${code}`,
      'VINCULAR',
      `VINCULAR ${code} e mais`,
    ];
    for (const [i, text] of tries.entries()) {
      await msg(`n${i}`, PHONE_A, text);
      await wait();
      expect(wa.sent.at(-1)!.text, text).toMatch(/^Oi! Eu sou o Tostão/);
    }
    expect(await linkedPhone(app, auth)).toBeNull();
  });

  it('o código tem formato TOST-+12 base32 (60 bits), vale 5 min e gerar outro invalida o anterior', async () => {
    const { app, wa, auth, msg } = await setup();
    const first = (await app.inject({ method: 'POST', url: '/whatsapp/code', headers: auth })).json();
    expect(first.code).toMatch(/^TOST-[A-Z2-7]{12}$/);
    const ttlMs = new Date(first.expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(4 * 60_000);
    expect(ttlMs).toBeLessThanOrEqual(5 * 60_000);

    const second = await newCode(app, auth);
    expect(second).not.toBe(first.code);
    await msg('old', PHONE_A, `VINCULAR ${first.code}`); // o anterior morreu
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/não vale/);
    expect(await linkedPhone(app, auth)).toBeNull();
    await msg('new', PHONE_A, `vincular   ${second.toLowerCase()}  `); // case-insensitive, com espaços
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/^Fechou, Pedro/);
    expect(await linkedPhone(app, auth)).toBe('•••• 7777');
  });

  it('o banco guarda só o hash do código, nunca o código', async () => {
    const { app, repos, auth } = await setup();
    const code = await newCode(app, auth);
    const rows = [...repos.whatsapp.items.values()];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.codeHash).toBe(hashLinkCode(code));
    expect(rows[0]!.codeHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256
    expect(JSON.stringify(rows)).not.toContain(code);
    expect(JSON.stringify(rows)).not.toContain(code.slice(5)); // nem o miolo
    expect(rows[0]).not.toHaveProperty('code');
  });

  it('gera códigos diferentes e com o alfabeto certo', () => {
    const codes = new Set(Array.from({ length: 500 }, generateLinkCode));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(c).toMatch(/^TOST-[A-Z2-7]{12}$/);
  });

  it('número já vinculado a outra conta NÃO é sequestrado nem trocado por VINCULAR', async () => {
    const { app, wa, auth, msg } = await setup();
    // A liga o número dela
    await msg('a1', PHONE_A, `VINCULAR ${await newCode(app, auth)}`);
    await wait();
    expect(await linkedPhone(app, auth)).toBe('•••• 7777');

    // B (outra conta) gera código e manda DO NÚMERO DA A
    const authB = await registerB(app);
    const codeB = await newCode(app, authB);
    await msg('b1', PHONE_A, `VINCULAR ${codeB}`);
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/já está ligado/);
    expect(await linkedPhone(app, auth)).toBe('•••• 7777'); // A continua dona
    expect(await linkedPhone(app, authB)).toBeNull(); // B não ganhou nada

    // e a A continua falando com os próprios dados, sem virar a B
    await msg('a2', PHONE_A, 'quanto gastei com delivery?');
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/Você gastou/);

    // o código da B não foi gasto: serve num número que ainda não é de ninguém
    await msg('b2', PHONE_B, `VINCULAR ${codeB}`);
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/^Fechou, Bia/);
    expect(await linkedPhone(app, authB)).toBe('•••• 6666');
  });

  it('quem já está vinculado e manda VINCULAR de novo também só recebe o aviso', async () => {
    const { app, wa, auth, msg } = await setup();
    await msg('a1', PHONE_A, `VINCULAR ${await newCode(app, auth)}`);
    await wait();
    await msg('a2', PHONE_A, `VINCULAR ${await newCode(app, auth)}`);
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/já está ligado/);
    expect(await linkedPhone(app, auth)).toBe('•••• 7777');
  });

  it('mais de 5 códigos errados bloqueia o número, até com o código certo; outro número não é afetado', async () => {
    const { app, wa, auth, msg } = await setup();
    const code = await newCode(app, auth);
    for (let i = 0; i < 5; i++) {
      await msg(`w${i}`, PHONE_A, `VINCULAR TOST-${'A'.repeat(11)}${'234567'[i]}`);
      await wait();
      expect(wa.sent.at(-1)!.text).toMatch(/não vale/);
    }
    await msg('w6', PHONE_A, 'VINCULAR TOST-BBBBBBBBBBBB');
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/Muitas tentativas/);
    await msg('w7', PHONE_A, `VINCULAR ${code}`); // código certo, mas número bloqueado
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/Muitas tentativas/);
    expect(await linkedPhone(app, auth)).toBeNull();

    await msg('w8', PHONE_B, `VINCULAR ${code}`); // outro número, não bloqueado
    await wait();
    expect(wa.sent.at(-1)!.text).toMatch(/^Fechou/);
  });

  describe('relógio: validade do código e janela do bloqueio', () => {
    function direct(now: { t: number }) {
      const repos = makeInMemoryRepositories();
      const wa = new FakeWhatsAppGateway(true, '5511900000000');
      const kv = new MemoryKeyValueStore(() => now.t);
      const clock = () => new Date(now.t);
      const ask = { execute: async () => ({ reply: { content: 'ok' } }) } as never;
      return {
        repos,
        wa,
        link: new WhatsAppLinkUseCase(repos, wa, clock),
        handle: new HandleWhatsAppMessageUseCase(repos, wa, ask, clock, undefined, kv),
      };
    }
    const reply = () => {
      const out: string[] = [];
      return { out, fn: async (t: string) => void out.push(t) };
    };

    it('código com mais de 5 minutos não vale', async () => {
      const now = { t: Date.parse('2026-11-20T12:00:00Z') };
      const { repos, link, handle } = direct(now);
      const user = await repos.users.create({ name: 'Ana', email: 'a@x.com', passwordHash: 'h' });
      const { code } = await link.createCode({ userId: user.id });
      now.t += 5 * 60_000 + 1;
      const r = reply();
      expect(await handle.execute({ id: '1', from: PHONE_A, text: `VINCULAR ${code}` }, r.fn)).toBe('codigo_invalido');
      expect(await repos.whatsapp.findByPhone(PHONE_A)).toBeNull();
    });

    it('o bloqueio some depois de 15 minutos', async () => {
      const now = { t: Date.parse('2026-11-20T12:00:00Z') };
      const { repos, link, handle } = direct(now);
      const user = await repos.users.create({ name: 'Ana', email: 'a@x.com', passwordHash: 'h' });
      const { code } = await link.createCode({ userId: user.id });
      for (let i = 0; i < 5; i++)
        await handle.execute({ id: `e${i}`, from: PHONE_A, text: 'VINCULAR TOST-AAAAAAAAAAAA' }, reply().fn);
      expect(await handle.execute({ id: 'b', from: PHONE_A, text: `VINCULAR ${code}` }, reply().fn)).toBe('bloqueado');
      now.t += 15 * 60_000;
      // o código antigo já venceu (5 min); com um novo, o número volta a poder tentar
      const fresh = await link.createCode({ userId: user.id });
      expect(await handle.execute({ id: 'c', from: PHONE_A, text: `VINCULAR ${fresh.code}` }, reply().fn)).toBe(
        'ligado',
      );
    });

    it('vincular com sucesso zera o contador de erros', async () => {
      const now = { t: Date.parse('2026-11-20T12:00:00Z') };
      const { repos, link, handle } = direct(now);
      const user = await repos.users.create({ name: 'Ana', email: 'a@x.com', passwordHash: 'h' });
      for (let i = 0; i < 4; i++)
        await handle.execute({ id: `e${i}`, from: PHONE_A, text: 'VINCULAR TOST-AAAAAAAAAAAA' }, reply().fn);
      const { code } = await link.createCode({ userId: user.id });
      expect(await handle.execute({ id: 'ok', from: PHONE_A, text: `VINCULAR ${code}` }, reply().fn)).toBe('ligado');
      await repos.whatsapp.unlink(user.id);
      const second = await link.createCode({ userId: user.id });
      for (let i = 0; i < 4; i++)
        await handle.execute({ id: `f${i}`, from: PHONE_A, text: 'VINCULAR TOST-AAAAAAAAAAAA' }, reply().fn);
      expect(await handle.execute({ id: 'ok2', from: PHONE_A, text: `VINCULAR ${second.code}` }, reply().fn)).toBe(
        'ligado',
      );
    });
  });
});

describe('webhooks: validação e comparação de segredo', () => {
  it('sameSecret não vaza nem o tamanho e nunca aceita vazio', () => {
    expect(sameSecret('segredo', 'segredo')).toBe(true);
    expect(sameSecret('segredo', 'segred')).toBe(false);
    expect(sameSecret('segredo', 'segredo-mais-longo-que-o-esperado')).toBe(false);
    expect(sameSecret('', '')).toBe(false);
    expect(sameSecret('segredo', undefined)).toBe(false);
  });

  it('GET do webhook: verify_token comparado em tempo constante, challenge e tamanhos validados', async () => {
    const { app } = await setup();
    const get = (q: string) => app.inject({ method: 'GET', url: `/whatsapp/webhook?${q}` });
    expect((await get('hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=abc-123')).body).toBe('abc-123');
    expect((await get('hub.mode=subscribe&hub.verify_token=verific&hub.challenge=1')).statusCode).toBe(403);
    expect((await get(`hub.mode=subscribe&hub.verify_token=${'x'.repeat(5000)}&hub.challenge=1`)).statusCode).toBe(400);
    expect(
      (await get(`hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=${'1'.repeat(300)}`)).statusCode,
    ).toBe(400);
    expect((await get('hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=%3Cscript%3E')).statusCode).toBe(400);
  });

  it('POST do webhook: texto acima de 4096 e estrutura inválida são recusados (400)', async () => {
    const { app, wa } = await setup();
    const post = (payload: unknown) =>
      app.inject({ method: 'POST', url: '/whatsapp/webhook', payload: payload as object });
    const msg = (text: unknown) => ({
      entry: [{ changes: [{ value: { messages: [{ id: 'z', from: PHONE_A, type: 'text', text: { body: text } }] } }] }],
    });
    expect((await post(msg('a'.repeat(4097)))).statusCode).toBe(400);
    expect((await post(msg(123))).statusCode).toBe(400);
    expect((await post({ entry: 'nao-e-lista' })).statusCode).toBe(400);
    expect(
      (
        await post({
          entry: [{ changes: [{ value: { messages: [{ id: 'x'.repeat(500), from: PHONE_A, type: 'text' }] } }] }],
        })
      ).statusCode,
    ).toBe(400);
    expect((await post(msg('a'.repeat(4096)))).statusCode).toBe(200);
    await wait();
    expect(wa.sent.length).toBeGreaterThan(0); // o de 4096 passou e foi tratado
  });
});

describe('CloudApiWhatsAppGateway.downloadMedia', () => {
  afterEach(() => vi.unstubAllGlobals());
  const gw = () => new CloudApiWhatsAppGateway('TOKEN-SECRETO', 'pn-id', 'app-secret', null);
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

  function stub(meta: Record<string, unknown>, file?: () => Response) {
    const calls: { url: string; auth: string | null }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), auth: new Headers(init?.headers).get('authorization') });
        if (String(url).includes('graph.facebook.com/v21.0/media-1')) return json(meta);
        if (file) return file();
        return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/ogg' } });
      }),
    );
    return calls;
  }

  it('aceita só https de host oficial da Meta', () => {
    for (const ok of [
      'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1',
      'https://graph.facebook.com/x',
      'https://scontent.xx.fbsbx.com/a',
    ])
      expect(isOfficialMetaMediaUrl(ok), ok).toBe(true);
    for (const bad of [
      'http://lookaside.fbsbx.com/a',
      'https://evil.com/a',
      'https://graph.facebook.com.evil.com/a',
      'https://fbsbx.com.evil.com/a',
      'https://evilfbsbx.com/a',
      'https://.fbsbx.com/a',
      'https://lookaside.fbsbx.com:8443/a',
      'https://u:p@lookaside.fbsbx.com/a',
      'https://169.254.169.254/latest',
      'file:///etc/passwd',
      'não é url',
    ])
      expect(isOfficialMetaMediaUrl(bad), bad).toBe(false);
  });

  it('baixa mídia válida e manda o token só pra Meta', async () => {
    const calls = stub({ url: 'https://lookaside.fbsbx.com/a?mid=1', mime_type: 'audio/ogg' });
    const media = await gw().downloadMedia('media-1');
    expect([...media!.bytes]).toEqual([1, 2, 3]);
    expect(media!.mimeType).toBe('audio/ogg');
    expect(calls.every((c) => /graph\.facebook\.com|fbsbx\.com/.test(c.url))).toBe(true);
  });

  it('rejeita URL fora da Meta SEM chamar o host nem mandar o token', async () => {
    for (const url of [
      'https://evil.com/steal',
      'http://lookaside.fbsbx.com/a',
      'http://127.0.0.1:3333/me',
      'https://169.254.169.254/x',
    ]) {
      const calls = stub({ url, mime_type: 'audio/ogg' });
      await expect(gw().downloadMedia('media-1'), url).rejects.toThrow(/fora da Meta/);
      expect(
        calls.map((c) => c.url).some((u) => u.startsWith(url)),
        url,
      ).toBe(false);
    }
  });

  it('rejeita arquivo acima de 10 MB (file_size, content-length ou corpo sem tamanho)', async () => {
    stub({ url: 'https://lookaside.fbsbx.com/a', file_size: MAX_MEDIA_BYTES + 1 });
    await expect(gw().downloadMedia('media-1')).rejects.toThrow(/grande demais/);

    stub(
      { url: 'https://lookaside.fbsbx.com/a' },
      () =>
        new Response(new Uint8Array(10), { status: 200, headers: { 'content-length': String(MAX_MEDIA_BYTES + 1) } }),
    );
    await expect(gw().downloadMedia('media-1')).rejects.toThrow(/grande demais/);

    // sem content-length (ou mentindo): o corpo é cortado no limite, nunca carregado inteiro
    let produced = 0;
    stub({ url: 'https://lookaside.fbsbx.com/a' }, () => {
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          produced += 1024 * 1024;
          controller.enqueue(new Uint8Array(1024 * 1024));
          if (produced > 100 * 1024 * 1024) controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    });
    await expect(gw().downloadMedia('media-1')).rejects.toThrow(/grande demais/);
    expect(produced).toBeLessThan(20 * 1024 * 1024); // parou cedo
  });

  it('exatamente 10 MB ainda passa', async () => {
    stub(
      { url: 'https://lookaside.fbsbx.com/a' },
      () => new Response(new Uint8Array(MAX_MEDIA_BYTES), { status: 200 }),
    );
    const media = await gw().downloadMedia('media-1');
    expect(media!.bytes.byteLength).toBe(MAX_MEDIA_BYTES);
  });
});

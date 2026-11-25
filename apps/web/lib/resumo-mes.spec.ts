// T6.19 · resumo do mês compartilhável: números, textos (valores escondidos por padrão), rota autenticada e desenho.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createWindowLimiter, drawableText, monthShare, shareTexts } from './resumo-mes';
import { shareImage, type ShareImageDeps } from './resumo-mes-handler';
import { renderShareImage, SHARE_HEIGHT, SHARE_WIDTH } from './resumo-mes-imagem';

const summary = {
  month: '2026-10',
  balanceInCents: 100,
  incomeInCents: 300_000,
  outcomeInCents: 231_000,
  uncategorizedCount: 0,
  byCategory: [
    { categoryId: null, name: 'Sem categoria', color: '#000', totalInCents: 150_000 },
    { categoryId: 'mercado', name: 'Mercado 🛒', color: '#000', totalInCents: 57_750 },
    { categoryId: 'lazer', name: 'Lazer', color: '#000', totalInCents: 20_000 },
  ],
  accounts: [],
  hiddenAccounts: [],
};
const progress = { done: [], streakDays: 12, doneToday: 0, bonusXp: 0 };
const share = () => monthShare(summary, progress, '2026-10', '2026-11');

describe('números do resumo', () => {
  it('% guardado sobre a renda e a maior categoria (com categoria) sobre os gastos', () => {
    expect(share()).toMatchObject({
      monthName: 'outubro',
      year: '2026',
      partial: false,
      savedPercent: 23,
      topCategory: { name: 'Mercado', percent: 25, totalInCents: 57_750 },
      streakDays: 12,
    });
  });

  it('mês no vermelho, sem renda, em andamento e sem ofensiva disponível', () => {
    const red = monthShare({ ...summary, outcomeInCents: 336_000 }, null, '2026-11', '2026-11');
    expect(red).toMatchObject({ savedPercent: -12, partial: true, streakDays: null });
    expect(shareTexts(red, false).headline).toMatchObject({ label: 'GASTEI', value: '112%', good: false });
    expect(shareTexts(red, false).subtitle).toBe('2026 · até aqui');
    expect(shareTexts({ ...red, savedPercent: -50_000 }, false).headline.value).toBe('+999%');
    const noIncome = monthShare({ ...summary, incomeInCents: 0, byCategory: [] }, progress, '2026-10', '2026-11');
    expect(noIncome.savedPercent).toBeNull();
    expect(shareTexts(noIncome, false).category.name).toBe('A descobrir');
  });

  it('por padrão nenhum texto tem valor em reais; com "mostrar valores" eles entram', () => {
    expect(JSON.stringify(shareTexts(share(), false))).not.toMatch(/R\$|3\.000|2\.310|577/);
    const shown = JSON.stringify(shareTexts(share(), true)).replace(/\s/g, ' ');
    for (const value of ['Entrou R$ 3.000,00', 'Saiu R$ 2.310,00', 'Sobrou R$ 690,00', 'R$ 577,50'])
      expect(shown).toContain(value);
  });

  it('tira do texto o que a fonte não desenha (emoji e outros alfabetos buscariam fonte fora)', () => {
    expect(drawableText('Pão & Café ☕🥐')).toBe('Pão & Café');
    expect(drawableText('🎮')).toBe('Outros');
    expect(drawableText('食費')).toBe('Outros');
    expect(drawableText('Assinaturas e serviços de streaming')).toBe('Assinaturas e servi...');
  });
});

describe('limite em memória', () => {
  it('libera de novo quando a janela passa e separa por pessoa', () => {
    let now = 0;
    const allow = createWindowLimiter(2, 1000, () => now);
    expect([allow('a'), allow('a'), allow('a'), allow('b')]).toEqual([true, true, false, true]);
    now = 1000;
    expect(allow('a')).toBe(true);
  });
});

const token = `x.${Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url')}.y`;
function deps(over: Partial<ShareImageDeps> = {}) {
  const calls: { url: string; auth: string | null }[] = [];
  const render = vi.fn(async () => new Uint8Array([137, 80, 78, 71]).buffer);
  const base: ShareImageDeps = {
    getToken: async () => token,
    apiUrl: 'http://api',
    now: () => new Date('2026-11-12T12:00:00Z'),
    allow: () => true,
    render,
    fetchImpl: (async (url: string, init?: RequestInit) => {
      calls.push({ url, auth: new Headers(init?.headers).get('authorization') });
      return new Response(JSON.stringify(url.includes('/summary') ? summary : progress), { status: 200 });
    }) as unknown as typeof fetch,
    ...over,
  };
  return { base, calls, render };
}
const req = (query = '', headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) =>
  new Request(`https://tostao.test/api/fechamento/imagem${query}`, { headers });

describe('GET /api/fechamento/imagem', () => {
  it('sem sessão: 401 e nada é buscado', async () => {
    const { base, calls, render } = deps({ getToken: async () => null });
    expect((await shareImage(req(), base)).status).toBe(401);
    expect(calls).toEqual([]);
    expect(render).not.toHaveBeenCalled();
  });

  it('pedido de outro site é recusado', async () => {
    const { base, calls } = deps();
    expect((await shareImage(req('', { 'sec-fetch-site': 'cross-site' }), base)).status).toBe(403);
    expect(calls).toEqual([]);
  });

  it('busca só resumo e ofensiva com o token da pessoa e responde PNG sem cache, valores escondidos', async () => {
    const { base, calls, render } = deps();
    const res = await shareImage(req('?userId=outra'), base);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('no-store, private');
    expect(calls.map((c) => c.url).sort()).toEqual(['http://api/progress', 'http://api/summary?month=2026-10']);
    expect(calls.every((c) => c.auth === `Bearer ${token}`)).toBe(true);
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ month: '2026-10' }), false);
  });

  it('"valores=1" mostra; qualquer outra coisa não', async () => {
    const { base, render } = deps();
    await shareImage(req('?mes=2026-09&valores=1'), base);
    await shareImage(req('?mes=2026-09&valores=true'), base);
    expect(render.mock.calls.map((c) => (c as unknown[])[1])).toEqual([true, false]);
  });

  it('mês inválido, mês vazio, limite, erro da API e falha no desenho', async () => {
    expect((await shareImage(req('?mes=2026-13'), deps().base)).status).toBe(400);
    expect((await shareImage(req('?mes=../me'), deps().base)).status).toBe(400);
    const empty = deps({
      fetchImpl: (async () =>
        new Response(JSON.stringify({ ...summary, incomeInCents: 0, outcomeInCents: 0 }))) as unknown as typeof fetch,
    });
    expect((await shareImage(req(), empty.base)).status).toBe(404);
    expect((await shareImage(req(), deps({ allow: () => false }).base)).status).toBe(429);
    const expired = deps({
      fetchImpl: (async () =>
        new Response(JSON.stringify({ message: 'Sessão expirada.' }), { status: 401 })) as unknown as typeof fetch,
    });
    expect((await shareImage(req(), expired.base)).status).toBe(401);
    const broken = deps({ render: async () => Promise.reject(new Error('sem fonte')) });
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    expect((await shareImage(req(), broken.base)).status).toBe(500);
  });
});

describe('desenho da imagem', () => {
  it('gera um PNG 1080×1920 sem buscar nada fora', async () => {
    const network = vi.spyOn(globalThis, 'fetch');
    const variants = {
      escondido: [share(), false],
      valores: [share(), true],
      vermelho: [monthShare({ ...summary, outcomeInCents: 336_000 }, progress, '2026-11', '2026-11'), true],
      // os textos mais compridos de cada bloco
      comprido: [
        monthShare(
          {
            ...summary,
            incomeInCents: 10_000_000_000,
            byCategory: [
              { categoryId: 'x', name: 'Assinaturas e serviços de streaming', color: '#000', totalInCents: 1 },
            ],
          },
          { ...progress, streakDays: 0 },
          '2026-09',
          '2026-11',
        ),
        true,
      ],
    } as const;
    for (const [name, [data, showValues]] of Object.entries(variants)) {
      const png = Buffer.from(await renderShareImage(data, showValues));
      expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([SHARE_WIDTH, SHARE_HEIGHT]);
      const out = process.env.SHARE_PREVIEW_DIR; // pra olhar o resultado: SHARE_PREVIEW_DIR=/tmp/x vitest run
      if (out) {
        mkdirSync(out, { recursive: true });
        writeFileSync(join(out, `${name}.png`), png);
      }
    }
    for (const call of network.mock.calls) expect(String(call[0])).not.toMatch(/^https?:/);
    network.mockRestore();
  }, 60_000);
});

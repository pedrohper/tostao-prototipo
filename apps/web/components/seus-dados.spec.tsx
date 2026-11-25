// T6.21 · botões de download em /mais e o repasse do CSV pelo BFF.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CSV_EXPORT, proxyExport } from '../lib/export-proxy';
import { SeusDados } from './seus-dados';

const read = (file: string) => readFileSync(join(__dirname, '..', file), 'utf8');

describe('SeusDados', () => {
  it('mostra a planilha ao lado do export da LGPD e avisa do limite somado', () => {
    const html = renderToString(<SeusDados />);
    expect(html).toContain('Baixar planilha (CSV)');
    expect(html).toContain('Baixar tudo (JSON)');
    expect(html).toContain('2 vezes por dia, somando os dois');
    expect(html.indexOf('(CSV)')).toBeLessThan(html.indexOf('(JSON)'));
  });

  it('/mais usa a seção', () => {
    expect(read('app/(app)/mais/page.tsx')).toContain('<SeusDados />');
  });
});

const APP = 'https://app.tostao.exemplo.com.br';
const deps = (fetchImpl: typeof fetch) => ({
  getToken: async () => 'jwt-da-pessoa',
  apiUrl: 'http://api.interna:3333',
  appPublicUrl: APP,
  fetchImpl,
});

describe('BFF do CSV', () => {
  const request = (query = '', site = 'same-origin') =>
    new Request(`${APP}/api/me/export.csv${query}`, { headers: { 'sec-fetch-site': site } });

  it('repassa só from/to, com o token da pessoa, e preserva o BOM', async () => {
    const body = new Uint8Array([0xef, 0xbb, 0xbf, 0x44]);
    const fetchImpl = vi.fn(
      async () =>
        new Response(body, { headers: { 'content-disposition': 'attachment; filename="tostao-lancamentos.csv"' } }),
    );
    const res = await proxyExport(
      request('?from=2026-01-01&to=2026-01-31&userId=outra'),
      deps(fetchImpl as unknown as typeof fetch),
      CSV_EXPORT,
    );
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.interna:3333/me/export.csv?from=2026-01-01&to=2026-01-31');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer jwt-da-pessoa');
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="tostao-lancamentos.csv"');
    expect(res.headers.get('cache-control')).toBe('no-store, private');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(body);
  });

  it('pedido de outro site não gasta a cota; 429 da API chega como veio', async () => {
    const never = vi.fn();
    const denied = await proxyExport(request('', 'cross-site'), deps(never as unknown as typeof fetch), CSV_EXPORT);
    expect(denied.status).toBe(403);
    expect(never).not.toHaveBeenCalled();

    const limited = await proxyExport(
      request(),
      deps(
        (async () =>
          new Response(JSON.stringify({ message: 'Muitas tentativas.' }), { status: 429 })) as unknown as typeof fetch,
      ),
      CSV_EXPORT,
    );
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ message: 'Muitas tentativas.' });
  });
});

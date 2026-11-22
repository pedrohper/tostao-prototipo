// T5.3 · POST /compartilhar (Share Target): anti-CSRF, sessão, tipo/tamanho, e o arquivo vai pra guarda só da pessoa.
import { beforeEach, describe, expect, it } from 'vitest';
import { FLASH_COOKIE, parseFlash } from './flash-toast';
import { handleShare } from './share-handler';
import { SHARE_MAX_BYTES } from './share-target';
import { clearShares, peekShare } from './share-stash';

const APP = 'https://tostao.exemplo.com';
const jwtFor = (sub: string) => `x.${Buffer.from(JSON.stringify({ sub, exp: 9_999_999_999 })).toString('base64url')}.y`;
const deps = (token: string | null = jwtFor('user-a')) => ({ getToken: async () => token, appPublicUrl: APP });

function share(
  files: File[] | File | null,
  headers: Record<string, string> = { 'sec-fetch-site': 'none' },
  extra: Record<string, string> = {},
) {
  const form = new FormData();
  for (const f of Array.isArray(files) ? files : files ? [files] : []) form.append('file', f);
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return new Request(`${APP}/compartilhar`, {
    method: 'POST',
    headers: { host: 'tostao.exemplo.com', ...headers },
    body: form,
  });
}
const pdf = (name = 'fatura.pdf') =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2])], name, { type: 'application/pdf' });
const location = (r: Response) => r.headers.get('location')!;
const flashOf = (r: Response) => {
  const c = r.headers.get('set-cookie') ?? '';
  const m = new RegExp(`${FLASH_COOKIE}=([^;]+)`).exec(c);
  return m ? (parseFlash(decodeURIComponent(m[1]!)) ?? parseFlash(m[1]!)) : null;
};
beforeEach(() => clearShares());

describe('handleShare', () => {
  it('PDF compartilhado: guarda pra essa pessoa e manda (303) pra /importar?arquivo=<id>', async () => {
    const r = await handleShare(share(pdf()), deps());
    expect(r.status).toBe(303);
    const url = new URL(location(r));
    expect(url.origin).toBe(APP);
    expect(url.pathname).toBe('/importar');
    const id = url.searchParams.get('arquivo')!;
    expect(peekShare('user-a', id)).toMatchObject({ name: 'fatura.pdf' });
    expect(peekShare('user-b', id)).toBeNull(); // outra pessoa não enxerga
  });

  it('OFX e CSV também seguem pro /importar; MIME genérico com extensão boa passa', async () => {
    for (const f of [
      new File(['<OFX>'], 'extrato.ofx'),
      new File(['a;b'], 'n.csv', { type: 'text/csv' }),
      new File([new Uint8Array([1])], 'x.pdf', { type: 'application/octet-stream' }),
    ]) {
      const r = await handleShare(share(f), deps());
      expect(new URL(location(r)).pathname, f.name).toBe('/importar');
      expect(new URL(location(r)).searchParams.get('arquivo')).toBeTruthy();
    }
  });

  it('imagem (comprovante): vai pro /anotar com aviso honesto, e NADA fica guardado', async () => {
    const r = await handleShare(share(new File([new Uint8Array([1])], 'comp.jpg', { type: 'image/jpeg' })), deps());
    expect(new URL(location(r)).pathname).toBe('/anotar');
    expect(flashOf(r)?.message).toMatch(/comprovante/i);
    expect(peekShare('user-a', 'qualquer')).toBeNull();
  });

  it('tipo não suportado e sem arquivo: voltam pro /importar com aviso de erro', async () => {
    const a = await handleShare(share(new File(['x'], 'planilha.xlsx', { type: 'application/vnd.ms-excel' })), deps());
    expect(location(a)).toBe(`${APP}/importar`);
    expect(flashOf(a)).toMatchObject({ variant: 'error' });
    const b = await handleShare(share(null, { 'sec-fetch-site': 'none' }, { title: 'só texto' }), deps());
    expect(location(b)).toBe(`${APP}/importar`);
    expect(flashOf(b)?.message).toMatch(/não recebi/i);
  });

  it('arquivo acima de 10 MB: recusado, nada guardado', async () => {
    const big = new File([new Uint8Array(SHARE_MAX_BYTES + 1)], 'grande.pdf', { type: 'application/pdf' });
    const r = await handleShare(share(big), deps());
    expect(location(r)).toBe(`${APP}/importar`);
    expect(flashOf(r)?.message).toMatch(/10 MB/);
  });

  it('sem sessão (ou token ilegível): vai pro /entrar com aviso, SEM guardar o arquivo', async () => {
    for (const token of [null, 'lixo']) {
      const r = await handleShare(share(pdf()), deps(token));
      expect(location(r)).toBe(`${APP}/entrar`);
      expect(flashOf(r)?.variant).toBe('info');
    }
  });

  it('anti-CSRF: Sec-Fetch-Site cross-site/same-site e Origin de outro site: 403 (e nada guardado)', async () => {
    for (const h of [
      { 'sec-fetch-site': 'cross-site' },
      { 'sec-fetch-site': 'same-site' },
      { origin: 'https://malvado.example' },
      { origin: 'null' },
    ] as Record<string, string>[]) {
      const r = await handleShare(share(pdf(), h), deps());
      expect(r.status, JSON.stringify(h)).toBe(403);
    }
  });

  it('não é multipart: 415; corpo declarado gigante: recusa antes de ler', async () => {
    const json = new Request(`${APP}/compartilhar`, {
      method: 'POST',
      headers: { 'sec-fetch-site': 'none', 'content-type': 'application/json' },
      body: '{}',
    });
    expect((await handleShare(json, deps())).status).toBe(415);
    const big = share(pdf());
    big.headers.set('content-length', String(SHARE_MAX_BYTES * 3));
    const r = await handleShare(big, deps());
    expect(location(r)).toBe(`${APP}/importar`);
    expect(flashOf(r)?.message).toMatch(/10 MB/);
  });

  it('nome com caminho/controle é saneado antes de ser guardado', async () => {
    const r = await handleShare(share(pdf('../../etc/passwd.pdf')), deps());
    const id = new URL(location(r)).searchParams.get('arquivo')!;
    expect(peekShare('user-a', id)!.name).toBe('passwd.pdf');
  });

  it('o redirect usa a origem PÚBLICA (APP_PUBLIC_URL), não a interna do servidor', async () => {
    const r = await handleShare(
      new Request('http://localhost:3000/compartilhar', {
        method: 'POST',
        headers: { host: 'localhost:3000', 'sec-fetch-site': 'none' },
        body: (() => {
          const f = new FormData();
          f.append('file', pdf());
          return f;
        })(),
      }),
      deps(),
    );
    expect(new URL(location(r)).origin).toBe(APP);
  });
});

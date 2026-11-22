// T5.3 · o que o Android precisa achar no manifest, e o que o proxy.ts faz com /compartilhar (sem enfraquecer a segurança).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { accessTokenSub } from './token-expiry';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('manifest.webmanifest · share_target', () => {
  const m = JSON.parse(read('../public/manifest.webmanifest'));
  it('POST multipart pra /compartilhar, campo "file" com OFX, CSV, PDF e imagens', () => {
    expect(m.share_target).toMatchObject({ action: '/compartilhar', method: 'POST', enctype: 'multipart/form-data' });
    const accept: string[] = m.share_target.params.files[0].accept;
    expect(m.share_target.params.files[0].name).toBe('file');
    for (const a of ['.ofx', '.csv', '.pdf', 'application/pdf', 'image/*']) expect(accept).toContain(a);
  });
  it('a action fica dentro do escopo do app (start_url /inicio, sem scope restritivo)', () => {
    expect(m.scope ?? '/').toBe('/');
    expect(m.share_target.action.startsWith('/')).toBe(true);
  });
});

describe('proxy.ts · matcher', () => {
  const src = read('../proxy.ts');
  const matcher = /matcher:\s*\[\s*'([^']+)'/.exec(src)![1]!.replace(/\\\\/g, '\\');
  const re = new RegExp(`^${matcher}$`);
  it('/compartilhar PASSA pelo proxy: é ele que renova a sessão antes do POST (o acesso vence a cada 15 min)', () => {
    expect(re.test('/compartilhar')).toBe(true);
    expect(re.test('/importar')).toBe(true);
  });
  it('o que sempre ficou de fora continua de fora (assets, manifest, SW, login social)', () => {
    for (const p of [
      '/_next/static/x.js',
      '/manifest.webmanifest',
      '/sw.js',
      '/icones/icon-192.png',
      '/api/auth/google',
      '/sair',
      '/elenco/a.webp',
    ])
      expect(re.test(p), p).toBe(false);
  });
  it('o proxy não toca no corpo: devolve NextResponse.next com o request (o multipart segue inteiro pra route)', () => {
    expect(src).toContain('NextResponse.next(');
    expect(src).not.toMatch(/request\.(formData|json|text|arrayBuffer)\(/);
  });
});

describe('accessTokenSub', () => {
  const tok = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
  it('lê o sub; lixo, sub vazio ou gigante vira null (nunca autoriza nada: é só chave da guarda temporária)', () => {
    expect(accessTokenSub(tok({ sub: 'abc-123' }))).toBe('abc-123');
    expect(accessTokenSub(tok({ sub: '' }))).toBeNull();
    expect(accessTokenSub(tok({ sub: 'x'.repeat(65) }))).toBeNull();
    expect(accessTokenSub(tok({ sub: 123 }))).toBeNull();
    expect(accessTokenSub('lixo')).toBeNull();
  });
});

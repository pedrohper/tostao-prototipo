// T6.16 · markup do "Cobrar no Pix" e do cartão da chave no perfil (renderToString, sem navegador).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CobrarPix } from './cobrar-pix';
import { PixKeyCard } from './pix-key-card';

const read = (file: string) => readFileSync(join(__dirname, '..', file), 'utf8');

describe('CobrarPix', () => {
  const html = renderToString(<CobrarPix code="000201CODIGO6304ABCD" message={'Oi, Bia! Ficou R$ 25,00.'} />);

  it('abre o WhatsApp sem número, com a mensagem pronta e sem a chave na URL', () => {
    const href = html.match(/href="(https:\/\/wa\.me\/\?text=[^"]+)"/)?.[1] ?? '';
    expect(decodeURIComponent(href)).toContain('Oi, Bia! Ficou R$ 25,00.');
    expect(href).not.toContain('CODIGO');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('mostra o botão, o código pra copiar na mão e o aviso em região viva', () => {
    expect(html).toContain('Cobrar no Pix');
    expect(html).toContain('000201CODIGO6304ABCD');
    expect(html).toContain('Copiar código');
    expect(html).toContain('aria-live="polite"');
  });

  it('copia dentro do toque, sem await antes do writeText', () => {
    const source = read('components/cobrar-pix.tsx');
    expect(source).toContain('navigator.clipboard?.writeText(code)');
    expect(source).not.toContain('await');
  });
});

describe('PixKeyCard', () => {
  it('sem chave: começa no CPF, sem botão de apagar, e os campos não têm name (a chave não vai pra URL)', () => {
    const html = renderToString(<PixKeyCard initial={{ pixKey: null, type: null }} />);
    expect(html).toContain('id="pix"');
    expect(html).toContain('Salvar chave');
    expect(html).not.toContain('Apagar chave');
    expect(html).not.toMatch(/<(input|select)[^>]*\sname=/);
    expect(html).toContain('method="post"');
  });

  it('com chave: preenche o tipo e o valor e deixa apagar', () => {
    const html = renderToString(<PixKeyCard initial={{ pixKey: '+5511912345678', type: 'telefone' }} />);
    expect(html).toContain('value="+5511912345678"');
    expect(html).toMatch(/<option value="telefone" selected="">Celular<\/option>/);
    expect(html).toContain('Apagar chave');
  });
});

describe('telas', () => {
  it('o acerto só busca a chave quando a pessoa te deve, e sem chave manda pro perfil', () => {
    const page = read('app/(app)/acertos/[id]/page.tsx');
    expect(page).toContain("deve ? api<PixKeyResponse>('/me/pix-key')");
    expect(page).toContain('#pix');
    expect(page).toContain('<CobrarPix');
  });

  it('o perfil mostra o cartão da chave', () => {
    expect(read('app/(app)/perfil/page.tsx')).toContain('<PixKeyCard');
  });
});

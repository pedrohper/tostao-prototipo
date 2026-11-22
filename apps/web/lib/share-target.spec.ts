import { describe, expect, it } from 'vitest';
import { classifySharedFile, isTrustedShareRequest, safeFileName } from './share-target';

describe('classifySharedFile', () => {
  it.each([
    [{ name: 'fatura.pdf', type: 'application/pdf' }, 'pdf'],
    [{ name: 'extrato', type: 'application/pdf' }, 'pdf'],
    [{ name: 'EXTRATO.PDF', type: 'application/octet-stream' }, 'pdf'], // o app do banco manda MIME genérico
    [{ name: 'extrato.ofx', type: 'application/x-ofx' }, 'statement'],
    [{ name: 'extrato.ofx', type: '' }, 'statement'],
    [{ name: 'nubank.csv', type: 'text/csv' }, 'statement'],
    [{ name: 'movimentos.txt', type: 'text/plain' }, 'statement'],
    [{ name: 'comprovante.jpg', type: 'image/jpeg' }, 'image'],
    [{ name: 'print', type: 'image/webp' }, 'image'],
    [{ name: 'planilha.xlsx', type: 'application/vnd.ms-excel' }, 'unsupported'],
    [{ name: 'virus.exe', type: 'application/x-msdownload' }, 'unsupported'],
    [{ name: '', type: '' }, 'unsupported'],
  ] as const)('%j → %s', (file, kind) => {
    expect(classifySharedFile(file)).toBe(kind);
  });
});

describe('isTrustedShareRequest (anti-CSRF do POST do compartilhamento)', () => {
  const own = ['tostao.exemplo.com'];
  const h = (o: Record<string, string>) => new Headers(o);
  it('o sistema compartilhando (Sec-Fetch-Site: none) e o próprio site (same-origin) passam', () => {
    expect(isTrustedShareRequest(h({ 'sec-fetch-site': 'none' }), own)).toBe(true);
    expect(isTrustedShareRequest(h({ 'sec-fetch-site': 'same-origin' }), own)).toBe(true);
  });
  it('outro site ou subdomínio mandando um <form>: barrado', () => {
    expect(isTrustedShareRequest(h({ 'sec-fetch-site': 'cross-site' }), own)).toBe(false);
    expect(isTrustedShareRequest(h({ 'sec-fetch-site': 'same-site' }), own)).toBe(false);
    // o Sec-Fetch-Site vence um Origin "bonzinho" forjado por quem não é navegador
    expect(
      isTrustedShareRequest(h({ 'sec-fetch-site': 'cross-site', origin: 'https://tostao.exemplo.com' }), own),
    ).toBe(false);
  });
  it('sem Sec-Fetch-Site: vale o Origin; Origin de outro site ou "null" barra; sem Origin passa (compartilhamento do sistema)', () => {
    expect(isTrustedShareRequest(h({ origin: 'https://tostao.exemplo.com' }), own)).toBe(true);
    expect(isTrustedShareRequest(h({ origin: 'https://malvado.example' }), own)).toBe(false);
    expect(isTrustedShareRequest(h({ origin: 'null' }), own)).toBe(false);
    expect(isTrustedShareRequest(h({ origin: 'lixo' }), own)).toBe(false);
    expect(isTrustedShareRequest(h({}), own)).toBe(true);
  });
});

describe('safeFileName', () => {
  it('tira caminho e caractere de controle, limita tamanho, nunca devolve vazio', () => {
    expect(safeFileName('C:\\Users\\x\\fatura.pdf')).toBe('fatura.pdf');
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('a\u0000b<script>.pdf')).toBe('abscript.pdf');
    expect(safeFileName('')).toBe('arquivo');
    expect(safeFileName('x'.repeat(500))).toHaveLength(120);
  });
});

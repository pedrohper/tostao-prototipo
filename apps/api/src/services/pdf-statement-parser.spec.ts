// T5.3 · leitura de PDF de fatura/extrato: validação do arquivo (magic bytes), timeout rígido e layouts por banco.
// Os fixtures são PDFs de verdade gerados na hora (test-support/make-pdf.ts) a partir de texto SANITIZADO: passam pelo mesmo
// extrator (unpdf em thread separada) que roda em produção.
import { describe, expect, it } from 'vitest';
import { FIXTURES, makePdf } from '../test-support/make-pdf.js';
import { assertPdf, extractPdfText, parsePdfStatement, parsePdfText, PdfParseError } from './pdf-statement-parser.js';

const NOW = new Date('2026-11-22T15:00:00Z');
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof PdfParseError ? e.code : `outro:${(e as Error).message}`;
  }
  return 'ok';
};

describe('validação do arquivo', () => {
  it('rejeita o que não é PDF, MESMO com o nome terminando em .pdf (quem manda é o conteúdo)', async () => {
    expect(await codeOf(extractPdfText(Buffer.from('<html><body>oi</body></html>')))).toBe('not_pdf');
    expect(await codeOf(extractPdfText(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))).toBe('not_pdf'); // PNG
    expect(await codeOf(extractPdfText(Buffer.from([0xff, 0xd8, 0xff, 0xe0])))).toBe('not_pdf'); // JPEG
    expect(await codeOf(extractPdfText(Buffer.from('conta;valor\n1;2')))).toBe('not_pdf'); // CSV
    expect(await codeOf(extractPdfText(new Uint8Array(0)))).toBe('not_pdf');
    expect(() => assertPdf(Buffer.from('%PDX-1.4'))).toThrow(PdfParseError);
  });

  it('aceita o cabeçalho %PDF- (mesmo com lixo curto antes, como alguns geradores fazem)', () => {
    expect(() => assertPdf(Buffer.from('%PDF-1.7\n...'))).not.toThrow();
    expect(() => assertPdf(Buffer.concat([Buffer.from('\n\n  '), Buffer.from('%PDF-1.4\n')]))).not.toThrow();
  });

  it('arquivo acima de 10 MB é recusado ANTES de abrir qualquer coisa', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0x20);
    big.write('%PDF-1.4', 0);
    expect(await codeOf(extractPdfText(big))).toBe('too_big');
  });

  it('PDF corrompido (cabeçalho certo, miolo lixo) vira erro amigável, sem derrubar o processo', async () => {
    const corrupted = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.from('isto não é um pdf de verdade '.repeat(50)),
    ]);
    expect(await codeOf(extractPdfText(corrupted))).toBe('unreadable');
  });

  it('timeout rígido: estourou o prazo, a thread é morta e o erro é "timeout"', async () => {
    const pdf = makePdf([['qualquer coisa 1,00']]);
    expect(await codeOf(extractPdfText(pdf, { timeoutMs: 1 }))).toBe('timeout');
    // e o processo segue de pé: a próxima leitura (prazo normal) funciona
    expect(await extractPdfText(pdf)).toContain('qualquer coisa');
  });

  it('limite de páginas', async () => {
    const pdf = makePdf([['a'], ['b'], ['c']]);
    expect(await codeOf(extractPdfText(pdf, { maxPages: 2 }))).toBe('too_many_pages');
  });
});

describe('extração + layouts (PDFs reais gerados dos fixtures)', () => {
  it('Nubank (fatura): data "05 NOV" sem ano, pagamento em linha própria, final do cartão ignorado', async () => {
    const { parsed } = await parsePdfStatement(makePdf([[...FIXTURES.nubankFatura]]), { now: NOW });
    expect(parsed.bank).toBe('Nubank');
    expect(parsed.kind).toBe('CREDIT');
    expect(parsed.rows.map((r) => [r.date, r.description, r.amountInCents])).toEqual([
      ['2026-11-05', 'Pagamento recebido', 500_00], // crédito: entra
      ['2026-11-05', 'Mercado Livre - Parcela 2/3', -123_45], // compra: sai
      ['2026-11-06', 'Padaria Central', -14_50],
      ['2026-12-07', 'Uber *Trip', -32_10],
    ]);
    expect(parsed.statedTotalInCents).toBe(170_05);
    expect(parsed.warnings).toEqual([]); // 123,45 + 14,50 + 32,10 = 170,05 = total da fatura
    expect(new Set(parsed.rows.map((r) => r.key)).size).toBe(4);
  });

  it('Inter (extrato): dois valores por linha (lançamento + saldo) e sinal pelo "-"', async () => {
    const { parsed } = await parsePdfStatement(makePdf([[...FIXTURES.interExtrato]]), { now: NOW });
    expect(parsed.bank).toBe('Inter');
    expect(parsed.kind).toBe('BANK');
    expect(parsed.rows.map((r) => [r.date, r.amountInCents])).toEqual([
      ['2026-11-03', 150_00],
      ['2026-11-04', -45_90],
      ['2026-11-05', -200_00],
    ]);
    expect(parsed.rows[0]!.description).toBe('Pix recebido Maria Exemplo');
  });

  it('Itaú (fatura): dd/mm usa o vencimento pra achar o ano; estorno entra com sinal positivo', async () => {
    const { parsed } = await parsePdfStatement(makePdf([[...FIXTURES.itauFatura]]), { now: NOW });
    expect(parsed.bank).toBe('Itaú');
    expect(parsed.kind).toBe('CREDIT');
    expect(parsed.rows.map((r) => [r.date, r.amountInCents])).toEqual([
      ['2026-11-05', -150_00],
      ['2026-11-20', -55_90],
      ['2026-11-28', 10_00],
    ]);
    expect(parsed.statedTotalInCents).toBe(195_90);
    expect(parsed.warnings).toEqual([]);
  });

  it('várias páginas', async () => {
    const half = FIXTURES.itauFatura.length - 2;
    const { parsed } = await parsePdfStatement(
      makePdf([[...FIXTURES.itauFatura.slice(0, half + 1)], [...FIXTURES.itauFatura.slice(half + 1)]]),
      { now: NOW },
    );
    expect(parsed.rows).toHaveLength(3);
  });
});

describe('parsePdfText (texto puro)', () => {
  it('virada de ano: compra de dezembro numa fatura que vence em janeiro é do ano ANTERIOR', () => {
    const p = parsePdfText('Santander\nFatura\nVencimento 10/01/2027\n20/12 LOJA EXEMPLO 80,00\n02/01 PADARIA 12,00', {
      now: NOW,
    });
    expect(p.bank).toBe('Santander');
    expect(p.rows.map((r) => r.date)).toEqual(['2026-12-20', '2027-01-02']);
  });

  it('Bradesco, C6 e outros: o banco é detectado; sem layout reconhecível, devolve vazio (quem chama decide)', () => {
    expect(parsePdfText('Bradesco Cartões\nVencimento 10/12/2026\n05/11 X 10,00', { now: NOW }).bank).toBe('Bradesco');
    expect(parsePdfText('C6 Bank\nFatura\nVencimento 10/12/2026\n05/11 X 10,00', { now: NOW }).bank).toBe('C6 Bank');
    expect(parsePdfText('Relatório qualquer\nnada de dinheiro aqui', { now: NOW }).rows).toEqual([]);
  });

  it('data inexistente (31/02, mês 13) descarta a linha em vez de inventar uma data', () => {
    const p = parsePdfText(
      'Inter\nExtrato conta corrente\n31/02/2026 Algo -10,00\n05/13/2026 Outro -10,00\n03/11/2026 Ok -5,00',
      { now: NOW },
    );
    expect(p.rows.map((r) => r.description)).toEqual(['Ok']);
  });

  it('chave estável: mesmo conteúdo = mesma chave; linhas idênticas no mesmo PDF ganham :1, :2 (não se fundem)', () => {
    const text = 'Inter\nExtrato conta corrente\n03/11/2026 Cafe -5,00\n03/11/2026 Cafe -5,00\n03/11/2026 Cafe -5,00';
    const a = parsePdfText(text, { now: NOW }).rows.map((r) => r.key);
    const b = parsePdfText(text, { now: NOW }).rows.map((r) => r.key);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
    expect(a[1]).toMatch(/:1$/);
  });

  it('total que não bate com as linhas gera aviso (pode ter faltado linha)', () => {
    const p = parsePdfText('Nubank\nFatura\nVencimento 10 DEZ 2026\nTotal a pagar R$ 999,00\n05 NOV Loja R$ 10,00', {
      now: NOW,
    });
    expect(p.warnings.join(' ')).toMatch(/não bate/);
  });

  it('extrato sem sinal claro: lê como entrada e AVISA', () => {
    const p = parsePdfText('Itaú\nExtrato conta corrente\n03/11/2026 TRANSFERENCIA 10,00', { now: NOW });
    expect(p.rows[0]!.amountInCents).toBe(10_00);
    expect(p.warnings.join(' ')).toMatch(/sem sinal claro/);
  });
});

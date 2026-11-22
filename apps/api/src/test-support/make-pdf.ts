// Gera um PDF mínimo e VÁLIDO (Helvetica, texto em WinAnsi/latin1) a partir de linhas de texto. Só pra testes: assim os
// fixtures "sanitizados" de fatura/extrato passam pelo extrator de verdade (unpdf/pdf.js), não por um mock.
export function makePdf(pages: string[][]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (m) => `\\${m}`).replace(/•/g, '\\225');
  const objs: string[] = [];
  const pageIds: number[] = [];
  // 1 catálogo, 2 páginas, 3 fonte; depois (página, conteúdo) de cada página
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push(''); // preenchido abaixo (Kids)
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  for (const lines of pages) {
    const content = `BT /F1 10 Tf 12 TL 40 800 Td\n${lines.map((l) => `(${esc(l)}) Tj T*`).join('\n')}\nET`;
    const pageId = objs.length + 1;
    pageIds.push(pageId);
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${pageId + 1} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
    objs.push(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
  }
  objs[1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

/** Fixtures SANITIZADOS (nomes e números inventados) no formato de cada banco. */
export const FIXTURES = {
  nubankFatura: [
    'Nubank',
    'Fatura fechada',
    'Data de vencimento: 10 DEZ 2026',
    'Total a pagar R$ 170,05',
    'TRANSAÇÕES DE 05 NOV A 05 DEZ',
    'Pagamento em 05 NOV -R$ 500,00',
    '05 NOV •••• 1234 Mercado Livre - Parcela 2/3 R$ 123,45',
    '06 NOV Padaria Central R$ 14,50',
    '07 DEZ Uber *Trip R$ 32,10',
  ],
  interExtrato: [
    'Banco Inter',
    'Extrato conta corrente',
    'Período: 01/11/2026 a 30/11/2026',
    'Saldo anterior 1.000,00',
    '03/11/2026 Pix recebido Maria Exemplo 150,00 1.150,00',
    '04/11/2026 Compra no débito Mercado Central -45,90 1.104,10',
    '05/11/2026 Pagamento de boleto Condomínio -200,00 904,10',
    'Saldo final 904,10',
  ],
  itauFatura: [
    'Itaú Unibanco',
    'Itaucard - fatura',
    'Vencimento 10/12/2026',
    'Total desta fatura R$ 195,90',
    '05/11 SUPERMERCADO EXTRA 150,00',
    '20/11 NETFLIX.COM 55,90',
    '28/11 ESTORNO LOJA EXEMPLO -10,00',
  ],
} as const;

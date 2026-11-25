// Planilha de lançamentos (T6.21). Pensada pro Excel em português: `;` entre as colunas, vírgula nos centavos, linhas
// terminadas em CRLF e BOM no começo (sem ele o Excel lê os acentos errado). Puro.

/**
 * CSV injection: planilha executa como fórmula a célula que começa com = + - @ (inclusive nas versões "largas"), e há
 * programas que fazem o mesmo depois de um tab, quebra de linha ou espaço. Descrição de extrato vem de terceiros.
 */
const FORMULA_START = /^[\t\r\n]|^\s*[=+\-@\uff1d\uff0b\uff0d\uff20]/;

/** Célula de TEXTO: sem fórmula, numa linha só e sempre entre aspas (um `;` ou aspas no meio não quebra a coluna). */
export function csvText(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  // eslint-disable-next-line no-control-regex -- remover caractere de controle é justamente o objetivo
  const oneLine = safe.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ');
  return `"${oneLine.replace(/"/g, '""')}"`;
}

/** Centavos -> "-1234,56": número que o Excel soma (sem "R$" nem separador de milhar). Gerado aqui, não precisa de escape. */
export function csvAmount(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

export type CsvTransaction = {
  /** AAAA-MM-DD no dia civil da pessoa. */
  day: string;
  description: string;
  category: string;
  account: string;
  amountInCents: number;
};

export function transactionsCsv(rows: CsvTransaction[]): string {
  const lines = rows.map((r) =>
    [
      r.day.split('-').reverse().join('/'),
      csvText(r.description),
      csvText(r.category),
      csvText(r.account),
      csvAmount(r.amountInCents),
    ].join(';'),
  );
  return `\ufeff${['Data;Descrição;Categoria;Conta;Valor', ...lines].join('\r\n')}\r\n`;
}

import { describe, expect, it } from 'vitest';
import { parseAmount, parseStatement } from './statement-parser.js';

const OFX = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261110000000[-3:BRT]<TRNAMT>-45.90<FITID>abc1<MEMO>IFOOD *LANCHE
</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261105<TRNAMT>1500.00<FITID>abc2<MEMO>Transferência recebida - PAI
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>842.30<DTASOF>20261112</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('extrato importado', () => {
  it('valores em formato BR e US', () => {
    expect(parseAmount('1.234,56')).toBe(123456);
    expect(parseAmount('-12.50')).toBe(-1250);
    expect(parseAmount('R$ 9,90')).toBe(990);
    expect(parseAmount('(10,00)')).toBe(-1000);
    expect(parseAmount('abc')).toBeNull();
  });

  it('OFX: valores, datas no dia certo, FITID e saldo', () => {
    const s = parseStatement(OFX, 'extrato.ofx');
    expect(s).toMatchObject({ format: 'ofx', kind: 'BANK', balanceInCents: 84230 });
    expect(s.transactions).toEqual([
      { externalId: 'ofx:abc1', occurredAt: new Date('2026-11-10T15:00:00Z'), amountInCents: -4590, description: 'IFOOD *LANCHE' },
      { externalId: 'ofx:abc2', occurredAt: new Date('2026-11-05T15:00:00Z'), amountInCents: 150000, description: 'Transferência recebida - PAI' },
    ]);
  });

  it('CSV da conta do Nubank (Data,Valor,Identificador,Descrição)', () => {
    const csv = 'Data,Valor,Identificador,Descrição\n10/11/2026,-25.00,id-1,"Compra no débito - PADARIA, CENTRO"\n11/11/2026,100.00,id-2,Transferência recebida';
    const s = parseStatement(csv, 'nubank.csv');
    expect(s.kind).toBe('BANK');
    expect(s.transactions.map((t) => [t.externalId, t.amountInCents, t.description])).toEqual([
      ['csv:id-1', -2500, 'Compra no débito - PADARIA, CENTRO'],
      ['csv:id-2', 10000, 'Transferência recebida'],
    ]);
  });

  it('CSV da fatura do Nubank: gasto vem positivo e vira negativo', () => {
    const csv = 'date,title,amount\n2026-11-03,Spotify,21.90\n2026-11-04,Pagamento recebido,-500.00\n2026-11-04,Cafe,8.00\n2026-11-04,Cafe,8.00';
    const s = parseStatement(csv, 'fatura.csv');
    expect(s.kind).toBe('CREDIT');
    expect(s.transactions.map((t) => t.amountInCents)).toEqual([-2190, 50000, -800, -800]);
    // dois cafés iguais no mesmo dia continuam sendo dois
    expect(new Set(s.transactions.map((t) => t.externalId)).size).toBe(4);
  });

  it('CSV com ponto e vírgula e título antes do cabeçalho', () => {
    const csv = 'Extrato conta corrente\nData;Histórico;Valor\n01/11/2026;PIX ENVIADO JOAO;-1.200,00';
    expect(parseStatement(csv, 'x.csv').transactions[0]).toMatchObject({ amountInCents: -120000, description: 'PIX ENVIADO JOAO' });
  });

  it('Bradesco/C6: crédito e débito em colunas separadas, linha de saldo pulada', () => {
    const csv = 'Extrato de: Agência 1234\nData;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)\n01/11/26;SALDO ANTERIOR;;;;100,00\n02/11/26;PIX RECEBIDO;123;50,00;;150,00\n03/11/26;COMPRA CARTAO;124;;-20,00;130,00';
    const s = parseStatement(csv, 'bradesco.csv');
    expect(s.transactions.map((t) => [t.occurredAt.toISOString().slice(0, 10), t.amountInCents, t.description])).toEqual([
      ['2026-11-02', 5000, 'PIX RECEBIDO'],
      ['2026-11-03', -2000, 'COMPRA CARTAO'],
    ]);
  });

  it('Inter: junta histórico e descrição, primeira data vale', () => {
    const csv = 'Extrato Conta Corrente\nPeríodo ;01/11/2026 a 12/11/2026\n\nData Lançamento;Histórico;Descrição;Valor;Saldo\n05/11/2026;Pix enviado ;Maria;-30,00;970,00';
    expect(parseStatement(csv, 'inter.csv').transactions[0]).toMatchObject({ amountInCents: -3000, description: 'Pix enviado - Maria' });
  });

  it('Mercado Pago: resumo antes, valor líquido e REFERENCE_ID', () => {
    const csv = 'INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE\n10,00;5,00;-3,00;12,00\n\nRELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE\n04-11-2026;Pagamento com QR Pix PADARIA;9911;-3,00;7,00\n05-11-2026;Rendimentos;9912;0,01;7,01';
    const s = parseStatement(csv, 'mp.csv');
    expect(s.transactions.map((t) => [t.externalId, t.amountInCents])).toEqual([['csv:9911', -300], ['csv:9912', 1]]);
  });

  it('BB: tudo entre aspas, com S A L D O no meio', () => {
    const csv = '"Data","Dependencia Origem","Histórico","Data do Balancete","Número do documento","Valor",\n"31/10/2026","","Saldo Anterior","","0","500.00",\n"03/11/2026","","Pix - Enviado","","1","-25.00",\n"12/11/2026","","S A L D O","","0","475.00",';
    expect(parseStatement(csv, 'bb.csv').transactions.map((t) => t.amountInCents)).toEqual([-2500]);
  });

  it('arquivo sem nada útil dá erro amigável', () => {
    expect(() => parseStatement('oi', 'x.csv')).toThrow('colunas de data e valor');
  });
});

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
      {
        externalId: 'ofx:abc1',
        occurredAt: new Date('2026-11-10T15:00:00Z'),
        amountInCents: -4590,
        description: 'IFOOD *LANCHE',
      },
      {
        externalId: 'ofx:abc2',
        occurredAt: new Date('2026-11-05T15:00:00Z'),
        amountInCents: 150000,
        description: 'Transferência recebida - PAI',
      },
    ]);
  });

  it('CSV da conta do Nubank (Data,Valor,Identificador,Descrição)', () => {
    const csv =
      'Data,Valor,Identificador,Descrição\n10/11/2026,-25.00,id-1,"Compra no débito - PADARIA, CENTRO"\n11/11/2026,100.00,id-2,Transferência recebida';
    const s = parseStatement(csv, 'nubank.csv');
    expect(s.kind).toBe('BANK');
    expect(s.transactions.map((t) => [t.externalId, t.amountInCents, t.description])).toEqual([
      ['csv:id-1', -2500, 'Compra no débito - PADARIA, CENTRO'],
      ['csv:id-2', 10000, 'Transferência recebida'],
    ]);
  });

  it('CSV da fatura do Nubank: gasto vem positivo e vira negativo', () => {
    const csv =
      'date,title,amount\n2026-11-03,Spotify,21.90\n2026-11-04,Pagamento recebido,-500.00\n2026-11-04,Cafe,8.00\n2026-11-04,Cafe,8.00';
    const s = parseStatement(csv, 'fatura.csv');
    expect(s.kind).toBe('CREDIT');
    expect(s.transactions.map((t) => t.amountInCents)).toEqual([-2190, 50000, -800, -800]);
    // dois cafés iguais no mesmo dia continuam sendo dois
    expect(new Set(s.transactions.map((t) => t.externalId)).size).toBe(4);
  });

  it('CSV com ponto e vírgula e título antes do cabeçalho', () => {
    const csv = 'Extrato conta corrente\nData;Histórico;Valor\n01/11/2026;PIX ENVIADO JOAO;-1.200,00';
    expect(parseStatement(csv, 'x.csv').transactions[0]).toMatchObject({
      amountInCents: -120000,
      description: 'PIX ENVIADO JOAO',
    });
  });

  it('Bradesco/C6: crédito e débito em colunas separadas, linha de saldo pulada', () => {
    const csv =
      'Extrato de: Agência 1234\nData;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)\n01/11/26;SALDO ANTERIOR;;;;100,00\n02/11/26;PIX RECEBIDO;123;50,00;;150,00\n03/11/26;COMPRA CARTAO;124;;-20,00;130,00';
    const s = parseStatement(csv, 'bradesco.csv');
    expect(
      s.transactions.map((t) => [t.occurredAt.toISOString().slice(0, 10), t.amountInCents, t.description]),
    ).toEqual([
      ['2026-11-02', 5000, 'PIX RECEBIDO'],
      ['2026-11-03', -2000, 'COMPRA CARTAO'],
    ]);
  });

  it('Inter: junta histórico e descrição, primeira data vale', () => {
    const csv =
      'Extrato Conta Corrente\nPeríodo ;01/11/2026 a 12/11/2026\n\nData Lançamento;Histórico;Descrição;Valor;Saldo\n05/11/2026;Pix enviado ;Maria;-30,00;970,00';
    expect(parseStatement(csv, 'inter.csv').transactions[0]).toMatchObject({
      amountInCents: -3000,
      description: 'Pix enviado - Maria',
    });
  });

  it('Mercado Pago: resumo antes, valor líquido e REFERENCE_ID', () => {
    const csv =
      'INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE\n10,00;5,00;-3,00;12,00\n\nRELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE\n04-11-2026;Pagamento com QR Pix PADARIA;9911;-3,00;7,00\n05-11-2026;Rendimentos;9912;0,01;7,01';
    const s = parseStatement(csv, 'mp.csv');
    expect(s.transactions.map((t) => [t.externalId, t.amountInCents])).toEqual([
      ['csv:9911', -300],
      ['csv:9912', 1],
    ]);
  });

  it('BB: tudo entre aspas, com S A L D O no meio', () => {
    const csv =
      '"Data","Dependencia Origem","Histórico","Data do Balancete","Número do documento","Valor",\n"31/10/2026","","Saldo Anterior","","0","500.00",\n"03/11/2026","","Pix - Enviado","","1","-25.00",\n"12/11/2026","","S A L D O","","0","475.00",';
    expect(parseStatement(csv, 'bb.csv').transactions.map((t) => t.amountInCents)).toEqual([-2500]);
  });

  it('arquivo sem nada útil dá erro amigável', () => {
    expect(() => parseStatement('oi', 'x.csv')).toThrow('colunas de data e valor');
  });

  describe('T1.5 · sinal, milhar, data, FITID e saldo', () => {
    it('milhar BR sem decimais: "1.500" = R$ 1.500 e "1.200.000" = R$ 1.200.000; decimal de verdade continua decimal', () => {
      expect(parseAmount('1.500')).toBe(150000);
      expect(parseAmount('1.200.000')).toBe(120000000);
      expect(parseAmount('-2.500')).toBe(-250000);
      expect(parseAmount('12.50')).toBe(1250);
      expect(parseAmount('0.500')).toBe(50); // 0,5 (não é milhar: grupo inicial 0)
      expect(parseAmount('1.234,56')).toBe(123456);
      expect(parseAmount('1,234.56')).toBe(123456);
    });

    it('data inexistente é recusada: 99/99/2026, 31/02/2026, mês 13, ano 1850', () => {
      const csv = (date: string) => `Data;Valor;Descrição\n${date};-10,00;Teste\n15/11/2026;-5,00;Outro`;
      for (const bad of ['99/99/2026', '31/02/2026', '10/13/2026', '00/11/2026', '15/11/1850']) {
        const s = parseStatement(csv(bad), 'x.csv');
        expect(
          s.transactions.map((t) => t.description),
          bad,
        ).toEqual(['Outro']); // só a linha boa sobrevive
      }
      // e arquivo cujas datas são TODAS inválidas dá erro amigável, em vez de data inválida no banco
      expect(() => parseStatement('Data;Valor;Descrição\n99/99/2026;-10,00;Teste', 'x.csv')).toThrow(
        /nenhuma transação/i,
      );
    });

    it('data válida vira meio-dia de Brasília (não pula pro dia anterior)', () => {
      const s = parseStatement('Data;Valor;Descrição\n29/02/2028;-10,00;Bissexto', 'x.csv');
      expect(s.transactions[0]!.occurredAt.toISOString()).toBe('2028-02-29T15:00:00.000Z');
    });

    it('cartão com colunas Crédito/Débito separadas NÃO inverte o sinal (débito já é negativo)', () => {
      const csv =
        'Data;Histórico;Crédito;Débito\n10/11/2026;COMPRA MERCADO;;250,00\n11/11/2026;PAGAMENTO FATURA;1000,00;';
      const s = parseStatement(csv, 'f.csv', { isCard: true });
      expect(s.kind).toBe('CREDIT');
      expect(s.transactions.map((t) => t.amountInCents)).toEqual([-25000, 100000]);
    });

    it('fatura de cartão que JÁ vem com compra negativa não é invertida (auto) — e a convenção pode ser forçada', () => {
      const negativas =
        'Data;Descrição;Valor\n10/11/2026;LOJA A;-50,00\n11/11/2026;LOJA B;-30,00\n12/11/2026;ESTORNO;10,00';
      expect(parseStatement(negativas, 'f.csv', { isCard: true }).transactions.map((t) => t.amountInCents)).toEqual([
        -5000, -3000, 1000,
      ]);
      const positivas =
        'Data;Descrição;Valor\n10/11/2026;LOJA A;50,00\n11/11/2026;LOJA B;30,00\n12/11/2026;PAGAMENTO;-80,00';
      expect(parseStatement(positivas, 'f.csv', { isCard: true }).transactions.map((t) => t.amountInCents)).toEqual([
        -5000, -3000, 8000,
      ]);
      // forçando: "compras-positivas" inverte; "compras-negativas" deixa como está
      expect(
        parseStatement(negativas, 'f.csv', { isCard: true, signConvention: 'compras-positivas' }).transactions[0]!
          .amountInCents,
      ).toBe(5000);
      expect(
        parseStatement(positivas, 'f.csv', { isCard: true, signConvention: 'compras-negativas' }).transactions[0]!
          .amountInCents,
      ).toBe(5000);
    });

    it('Nubank (title,amount): empate de sinais cai no formato conhecido (inverte)', () => {
      const s = parseStatement('date,title,amount\n2026-11-10,Uber,25.90\n2026-11-11,Pagamento,-25.90', 'nu.csv');
      expect(s.transactions.map((t) => t.amountInCents)).toEqual([-2590, 2590]);
    });

    it('conta corrente nunca inverte, mesmo com isCard desligado e maioria positiva', () => {
      const s = parseStatement('Data;Descrição;Valor\n10/11/2026;SALARIO;3000,00\n11/11/2026;PIX;100,00', 'c.csv', {
        isCard: false,
      });
      expect(s.transactions.map((t) => t.amountInCents)).toEqual([300000, 10000]);
    });

    it('coluna "Valor Débito/Crédito" (uma só) é o valor com sinal e não casa nas duas buscas', () => {
      const s = parseStatement(
        'Data;Histórico;Valor Débito/Crédito\n10/11/2026;COMPRA;-45,00\n11/11/2026;DEPOSITO;100,00',
        'x.csv',
      );
      expect(s.transactions.map((t) => t.amountInCents)).toEqual([-4500, 10000]);
    });

    it('OFX com FITID repetido (BB/Caixa mandam FITID=0 em tudo): cada lançamento mantém identidade própria e estável', () => {
      const ofx = (v: string) => `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261110<TRNAMT>-10.00<FITID>0<MEMO>CAFE
</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261110<TRNAMT>-10.00<FITID>0<MEMO>CAFE
</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261111<TRNAMT>-${v}<FITID>0<MEMO>PADARIA
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
      const a = parseStatement(ofx('7.00'), 'bb.ofx').transactions.map((t) => t.externalId);
      expect(new Set(a).size).toBe(3); // nada de 3 lançamentos com o mesmo id (o import os trataria como duplicados)
      expect(a.every((id) => !id.startsWith('ofx:0'))).toBe(true);
      // importar o MESMO arquivo de novo dá os mesmos ids (não duplica)
      expect(parseStatement(ofx('7.00'), 'bb.ofx').transactions.map((t) => t.externalId)).toEqual(a);
      // FITID único segue valendo como identidade
      expect(parseStatement(OFX, 'extrato.ofx').transactions[0]!.externalId).toBe('ofx:abc1');
    });

    it('OFX de cartão: BALAMT vira "quanto devo" (negativo), venha positivo ou negativo do banco', () => {
      const card = (bal: string) => `<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261110<TRNAMT>-50.00<FITID>1<MEMO>LOJA
</STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>${bal}<DTASOF>20261112</LEDGERBAL></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;
      expect(parseStatement(card('1234.56'), 'c.ofx').balanceInCents).toBe(-123456);
      expect(parseStatement(card('-1234.56'), 'c.ofx').balanceInCents).toBe(-123456);
      // conta corrente mantém o sinal que o banco mandou
      expect(parseStatement(OFX, 'extrato.ofx').balanceInCents).toBe(84230);
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { ImportPreviewRow } from '@tostao/contracts';
import { buildRowsBody, centsToInput, keptTotal, toEditable } from './pdf-import';

const rows: ImportPreviewRow[] = [
  { key: 'aaaaaaaaaaaaaaaa', date: '2026-11-05', description: 'Mercado', amountInCents: -123_45 },
  { key: 'bbbbbbbbbbbbbbbb', date: '2026-11-06', description: 'Pagamento recebido', amountInCents: 500_00 },
  { key: 'cccccccccccccccc:1', date: '2026-11-07', description: 'Uber', amountInCents: -32_10 },
];
const meta = { accountName: 'Nubank cartão', fileName: 'f.pdf', isCard: true };

describe('toEditable / centsToInput', () => {
  it('valor vira texto BR e o sinal vira "saída"', () => {
    const e = toEditable(rows);
    expect(e.map((r) => [r.amount, r.out, r.keep])).toEqual([
      ['123,45', true, true],
      ['500,00', false, true],
      ['32,10', true, true],
    ]);
    expect(centsToInput(-5)).toBe('0,05');
  });
});

describe('buildRowsBody', () => {
  it('sem mexer: devolve as mesmas linhas (mesmas chaves, mesmos sinais)', () => {
    const r = buildRowsBody(toEditable(rows), meta);
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.body.rows).toEqual(
        rows.map(({ key, date, description, amountInCents }) => ({ key, date, description, amountInCents })),
      );
  });

  it('editar valor/descrição/sentido vale; a chave original NÃO muda (reimportar não duplica)', () => {
    const e = toEditable(rows);
    e[0] = { ...e[0]!, amount: '1.234,56', description: '  Supermercado  ', out: false };
    const r = buildRowsBody(e, meta);
    if (!r.ok) throw new Error('esperava ok');
    expect(r.body.rows[0]).toEqual({
      key: 'aaaaaaaaaaaaaaaa',
      date: '2026-11-05',
      description: 'Supermercado',
      amountInCents: 1234_56,
    });
  });

  it('linhas desmarcadas ficam de fora; tudo desmarcado = erro claro', () => {
    const e = toEditable(rows).map((r, i) => ({ ...r, keep: i === 1 }));
    const r = buildRowsBody(e, meta);
    if (!r.ok) throw new Error('esperava ok');
    expect(r.body.rows).toHaveLength(1);
    const none = buildRowsBody(
      e.map((x) => ({ ...x, keep: false })),
      meta,
    );
    expect(none.ok).toBe(false);
  });

  it('valor, data ou descrição inválidos apontam a linha e não gravam nada', () => {
    const e = toEditable(rows);
    e[0] = { ...e[0]!, amount: 'abc' };
    e[1] = { ...e[1]!, date: '06/11/2026' };
    e[2] = { ...e[2]!, description: '   ' };
    const r = buildRowsBody(e, meta);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.index)).toEqual([0, 1, 2]);
    // "1,500" é ambíguo: melhor pedir de novo que errar 100x (a mesma regra do resto do app)
    const amb = toEditable(rows);
    amb[0] = { ...amb[0]!, amount: '1,500' };
    expect(buildRowsBody(amb, meta).ok).toBe(false);
  });
});

describe('keptTotal', () => {
  it('fatura: só o que saiu; conta: saldo do período; ignora desmarcadas e valores quebrados', () => {
    const e = toEditable(rows);
    expect(keptTotal(e, true)).toBe(155_55);
    expect(keptTotal(e, false)).toBe(500_00 - 123_45 - 32_10);
    e[0] = { ...e[0]!, keep: false };
    e[1] = { ...e[1]!, amount: 'xx' };
    expect(keptTotal(e, true)).toBe(32_10);
  });
});

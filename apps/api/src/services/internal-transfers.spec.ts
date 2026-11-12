import { describe, expect, it } from 'vitest';
import { detectInternalTransfers } from './internal-transfers.js';
import type { Transaction } from '../domain/entities.js';

let seq = 0;
const tx = (accountId: string | null, amountInCents: number, day: number, description = 'PIX'): Transaction => ({
  id: `t${++seq}`, userId: 'u1', accountId, externalId: null, description, amountInCents,
  occurredAt: new Date(Date.UTC(2026, 10, day, 12)), categoryId: null, isInternalTransfer: false, createdAt: new Date(),
});

describe('detectInternalTransfers', () => {
  it('marca o par saída/entrada de mesmo valor entre contas diferentes', () => {
    const out = tx('nubank', -10000, 4);
    const inn = tx('mp', 10000, 4);
    const other = tx('nubank', -5000, 4);
    const ids = detectInternalTransfers([out, inn, other]);
    expect(ids).toEqual(new Set([out.id, inn.id]));
  });
  it('não pareia na mesma conta', () => {
    expect(detectInternalTransfers([tx('nubank', -10000, 4), tx('nubank', 10000, 4)]).size).toBe(0);
  });
  it('não pareia com mais de 1 dia de distância', () => {
    expect(detectInternalTransfers([tx('nubank', -10000, 4), tx('mp', 10000, 7)]).size).toBe(0);
  });
  it('não pareia gasto anotado na mão', () => {
    expect(detectInternalTransfers([tx(null, -10000, 4), tx('mp', 10000, 4)]).size).toBe(0);
  });
  it('pagamento de fatura é interno pela descrição', () => {
    const fatura = tx('nubank', -45000, 10, 'Pagamento de fatura');
    expect(detectInternalTransfers([fatura]).has(fatura.id)).toBe(true);
  });
  it('fatura do Nubank paga por Pix de outra conta e débito automático da fatura são internos', () => {
    const pix = tx('mp', -24240, 30, 'Pagamento com Pix NU PAGAMENTOS SA');
    const deb = tx('elo', 17358, 4, 'PAGTO. POR DEB EM C/C');
    const amiga = tx('mp', -660, 30, 'Pix enviado Amanda Costa');
    expect(detectInternalTransfers([pix, deb, amiga])).toEqual(new Set([pix.id, deb.id]));
  });
});

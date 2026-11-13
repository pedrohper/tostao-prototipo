import { describe, expect, it } from 'vitest';
import { aliquotaIR, anualParaMensal, compararCompra, mensalParaAnual, mesesParaJuntar, parcelaPrice, poupancaAnual, rendimento, taxaImplicita } from '@tostao/contracts';

describe('contas de juros', () => {
  it('converte taxa anual em mensal e volta', () => {
    expect(anualParaMensal(0.12)).toBeCloseTo(0.009489, 5);
    expect(mensalParaAnual(anualParaMensal(0.149))).toBeCloseTo(0.149, 10);
  });

  it('calcula parcela da tabela Price', () => {
    // R$ 1.000 a 2% ao mês em 12x = R$ 94,56
    expect(parcelaPrice(100000, 0.02, 12)).toBe(9456);
    expect(parcelaPrice(100000, 0, 10)).toBe(10000);
  });

  it('acha os juros escondidos no parcelado', () => {
    expect(taxaImplicita(100000, 10000, 10)).toBe(0); // sem juros de verdade
    const r = taxaImplicita(100000, 11000, 10); // 10x de R$ 110 num produto de R$ 1.000
    expect(r).toBeGreaterThan(0.017);
    expect(r).toBeLessThan(0.018);
    expect(parcelaPrice(100000, r, 10)).toBe(11000);
    // com desconto no Pix: R$ 900 à vista ou 10x R$ 100
    expect(taxaImplicita(90000, 10000, 10)).toBeCloseTo(0.0196, 3);
  });

  it('usa a tabela regressiva do IR', () => {
    expect(aliquotaIR(30)).toBe(0.225);
    expect(aliquotaIR(200)).toBe(0.2);
    expect(aliquotaIR(365)).toBe(0.175);
    expect(aliquotaIR(800)).toBe(0.15);
  });

  it('calcula rendimento líquido', () => {
    const r = rendimento(100000, 0.149, 12);
    expect(r.brutoInCents).toBe(14900);
    expect(r.irInCents).toBe(Math.round(14900 * 0.175));
    expect(r.finalInCents).toBe(100000 + 14900 - r.irInCents);
    expect(rendimento(100000, 0.0617, 12, true).irInCents).toBe(0);
  });

  it('poupança segue a regra da Selic', () => {
    expect(poupancaAnual(0.15)).toBeCloseTo(0.0617, 4);
    expect(poupancaAnual(0.07)).toBeCloseTo(0.049, 6);
  });

  it('parcelado sem juros e sem desconto: vale parcelar e deixar o dinheiro rendendo', () => {
    const v = compararCompra({ aVistaInCents: 100000, parcelaInCents: 10000, parcelas: 10, rendeAnual: 0.149 });
    expect(v.jurosInCents).toBe(0);
    expect(v.melhor).toBe('parcelado');
    expect(v.saldoParcelandoInCents).toBeGreaterThan(3000);
  });

  it('desconto de 10% no Pix ganha do parcelado', () => {
    const v = compararCompra({ aVistaInCents: 90000, parcelaInCents: 10000, parcelas: 10, rendeAnual: 0.149 });
    expect(v.jurosInCents).toBe(10000);
    expect(v.melhor).toBe('a-vista');
    expect(v.saldoParcelandoInCents).toBeLessThan(0);
  });

  it('desconto pequeno empata com o rendimento', () => {
    const v = compararCompra({ aVistaInCents: 95000, parcelaInCents: 10000, parcelas: 10, rendeAnual: 0.149 });
    expect(v.melhor).toBe('empate');
  });

  it('diz em quantos meses dá pra juntar', () => {
    expect(mesesParaJuntar(100000, 10000, 0)).toBe(10);
    expect(mesesParaJuntar(100000, 10000, 0.149)).toBe(10);
    expect(mesesParaJuntar(100000, 9500, 0.149)).toBe(11);
    expect(mesesParaJuntar(100000, 0, 0.149)).toBeNull();
    expect(mesesParaJuntar(100000, 100, 0.149, 100000)).toBe(0);
  });
});

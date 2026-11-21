import { describe, expect, it } from 'vitest';
import {
  aliquotaIR,
  anualParaMensal,
  compararCompra,
  mensalParaAnual,
  mesesParaJuntar,
  parcelaPrice,
  poupancaAnual,
  rendimento,
  taxaImplicita,
} from './juros';

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

  describe('T1.5 · IR regressivo por mês de resgate', () => {
    it('o IR do parcelado NÃO usa a alíquota do prazo final em todos os meses', () => {
      // Antes: 24x aplicava 15% (prazo > 720 dias) desde o mês 1. Agora o mês 1 paga 22,5% e o último 15%.
      const compra = { aVistaInCents: 240000, parcelaInCents: 10000, parcelas: 24, rendeAnual: 0.149 };
      const v = compararCompra(compra);
      let antigo = compra.aVistaInCents;
      const rAntigo = anualParaMensal(0.149) * (1 - aliquotaIR(Math.round(24 * 30.42)));
      for (let i = 0; i < 24; i++) antigo = antigo * (1 + rAntigo) - compra.parcelaInCents;
      // o modelo antigo era otimista demais (imposto menor nos primeiros meses): o novo rende MENOS
      expect(v.saldoParcelandoInCents).toBeLessThan(Math.round(antigo));
      expect(v.saldoParcelandoInCents).toBeGreaterThan(0);
    });

    it('parcela única (1x) paga a alíquota de 30 dias (22,5%), não a de longo prazo', () => {
      const v = compararCompra({ aVistaInCents: 100000, parcelaInCents: 100000, parcelas: 1, rendeAnual: 0.149 });
      const esperado = Math.round(100000 * (1 + anualParaMensal(0.149) * (1 - 0.225)) - 100000);
      expect(v.saldoParcelandoInCents).toBe(esperado);
    });

    it('parcelas precisa ser inteiro >= 1', () => {
      for (const parcelas of [0, -3, 2.5, Number.NaN]) {
        expect(() =>
          compararCompra({ aVistaInCents: 100000, parcelaInCents: 10000, parcelas, rendeAnual: 0.1 }),
        ).toThrow(RangeError);
      }
    });
  });

  describe('T1.5 · mesesParaJuntar', () => {
    it('sem aporte mensal mas com saldo: cresce só por juros compostos', () => {
      const meses = mesesParaJuntar(120000, 0, 0.149, 100000);
      expect(meses).not.toBeNull();
      // 100.000 -> 120.000 (+20%) a ~1,16% a.m. bruto, líquido de IR: bem mais de 12 meses
      expect(meses!).toBeGreaterThan(14);
      expect(meses!).toBeLessThan(30);
      // sem rendimento e sem aporte nunca chega
      expect(mesesParaJuntar(120000, 0, 0, 100000)).toBeNull();
    });

    it('sem aporte e sem saldo é impossível; aporte negativo também', () => {
      expect(mesesParaJuntar(100000, 0, 0.149, 0)).toBeNull();
      expect(mesesParaJuntar(100000, -10, 0.149, 5000)).toBeNull();
    });

    it('o IR usa o prazo REAL encontrado (23 meses pagam menos IR que 12)', () => {
      // alvo curto: ~6 meses (22,5%); alvo longo: > 24 meses (15%). O longo precisa render mais líquido por mês.
      const curto = mesesParaJuntar(60000, 10000, 0.149)!;
      const longo = mesesParaJuntar(600000, 10000, 0.149)!;
      expect(curto).toBeLessThanOrEqual(6);
      // com 22,5% fixo (modelo antigo em 360d = 17,5%), o longo demoraria mais meses
      let antigo = 0;
      const rAntigo = anualParaMensal(0.149) * (1 - aliquotaIR(360));
      let m = 0;
      while (antigo < 600000 && m < 240) {
        antigo = antigo * (1 + rAntigo) + 10000;
        m++;
      }
      expect(longo).toBeLessThanOrEqual(m);
    });
  });
});

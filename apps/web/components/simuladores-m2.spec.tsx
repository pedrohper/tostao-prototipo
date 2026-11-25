// T6.15 · Módulo 2 no SimuladorShell (m2-l2 é piloto): a MATEMÁTICA NÃO MUDOU. As funções `antes*` são cópia literal
// das contas que estavam em simulators-m2-m5.tsx e juros.tsx (valores em reais onde era assim); as posições das réguas
// antigas são comparadas com a conta nova (em centavos). Depois, a tela.
import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import { TAXAS_REFERENCIA, compararCompra, pct } from '@tostao/contracts';
import {
  avaliarCompra,
  CompensaParcelar,
  palpiteCertoDaCompra,
} from '@/app/(app)/aprender/[licao]/_simuladores/compensa-parcelar';
import {
  calcularIlusaoDePoder,
  IlusaoDePoder,
  palpiteCertoDoLimite,
} from '@/app/(app)/aprender/[licao]/_simuladores/ilusao-de-poder';
import { MODULO_2 } from '@/app/(app)/aprender/[licao]/_simuladores/modulo-2';
import {
  calcularRaioXDoPix,
  faixaDaParcela,
  palpiteCertoDoPix,
  parcelaMinima,
  parcelaSugerida,
  RaioXDoCetNoPix,
} from '@/app/(app)/aprender/[licao]/_simuladores/raio-x-do-cet-no-pix';
import {
  calcularReguaDeDatas,
  palpiteCertoDasDatas,
  ReguaDeDatas,
} from '@/app/(app)/aprender/[licao]/_simuladores/regua-de-datas';
import { money, parseMoney } from '@/lib/format';
import { getDictionary } from '@/lib/i18n';
import { InstallmentCalculator } from './juros';
import { montar } from './mini-render.testutil';
import {
  aberto,
  grande,
  limites,
  mover,
  palpitar,
  plain,
  principalForaDoMais,
  regua,
  reguaDe,
  tudo,
} from './simulador.testutil';

const emPortugues = () => <CompensaParcelar locale="pt-BR" />;
/** Dinheiro como aparece em `tudo()`. */
const reais = (cents: number) => plain(money(cents));

// ---------- As contas de ANTES (cópia literal) ----------

function antesIlusao(limite: number, renda: number) {
  const rendaCents = renda * 100;
  const diariaCents = Math.round(rendaCents / 22);
  const diasTrabalho = Math.round((limite / renda) * 22);
  const multiplo = limite / renda;
  return { diariaCents, diasTrabalho, multiplo };
}

function antesCompra(aVista: string, parcela: string, n: number) {
  const av = parseMoney(aVista) ?? 0;
  const pa = parseMoney(parcela) ?? 0;
  const ok = av > 0 && pa > 0 && Number.isInteger(n) && n >= 1;
  return ok
    ? compararCompra({ aVistaInCents: av, parcelaInCents: pa, parcelas: n, rendeAnual: TAXAS_REFERENCIA.cdi })
    : null;
}

function antesPix(valorPix: number, parcelas: number, valorParcela: number) {
  const valorCents = valorPix * 100;
  const parcelaCents = valorParcela * 100;
  const totalPagoCents = parcelaCents * parcelas;
  const jurosCents = totalPagoCents - valorCents;
  const calcularTaxaMensal = (): number => {
    if (totalPagoCents <= valorCents || parcelas <= 0) return 0;
    let low = 0.00001;
    let high = 2.0;
    for (let iter = 0; iter < 60; iter++) {
      const mid = (low + high) / 2;
      const pv = parcelaCents * ((1 - Math.pow(1 + mid, -parcelas)) / mid);
      if (pv > valorCents) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return ((low + high) / 2) * 100;
  };
  const taxaMensalPct = calcularTaxaMensal();
  const taxaAnualPct = (Math.pow(1 + taxaMensalPct / 100, 12) - 1) * 100;
  return { totalPagoCents, jurosCents, taxaMensalPct, taxaAnualPct };
}

const antesFaixaPix = (valorPix: number, parcelas: number) => ({
  min: Math.max(10, Math.floor(valorPix / parcelas)),
  max: Math.ceil((valorPix * 1.8) / parcelas) + 50,
});

function antesDatas(fechamento: number, vencimento: number, compra: number) {
  const caiNaProxima = compra >= fechamento;
  const gapFechVenc = vencimento >= fechamento ? vencimento - fechamento : 30 - fechamento + vencimento;
  const diasFolego = caiNaProxima ? 30 - compra + fechamento + gapFechVenc : fechamento - compra + gapFechVenc;
  return { caiNaProxima, diasFolego };
}

describe('a matemática não mudou (posições das réguas de antes)', () => {
  it('m2-l1 Ilusão de poder: todas', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const limite of regua(500, 15_000, 250))
      for (const renda of regua(1200, 10_000, 100)) {
        casos++;
        const antes = antesIlusao(limite, renda);
        const agora = calcularIlusaoDePoder({ limiteCents: limite * 100, rendaCents: renda * 100 });
        if (
          agora.diariaCents !== antes.diariaCents ||
          agora.diasDeTrabalho !== antes.diasTrabalho ||
          agora.multiplo !== antes.multiplo
        )
          diferentes.push([limite, renda]);
      }
    expect(casos).toBe(59 * 89);
    expect(diferentes).toEqual([]);
  });

  it('m2-l3 Compensa parcelar: amostra com os extremos, igual ao que a calculadora calculava', () => {
    let casos = 0;
    for (const av of [1_000, 9_990, 50_000, 89_990, 90_000, 99_999, 100_000, 250_000, 2_000_000])
      for (const pa of [500, 1_000, 5_000, 9_999, 10_000, 25_000, 500_000])
        for (const n of regua(1, 48, 1)) {
          casos++;
          const texto = (c: number) => (c / 100).toFixed(2).replace('.', ',');
          expect(avaliarCompra({ aVistaCents: av, parcelaCents: pa, parcelas: n })).toEqual(
            antesCompra(texto(av), texto(pa), n),
          );
        }
    expect(casos).toBe(9 * 7 * 48);
  });

  it('m2-l4 Pix: todas as posições (a régua da parcela depende das outras duas)', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const v of regua(100, 3000, 50))
      for (const n of regua(2, 12, 1)) {
        const faixa = antesFaixaPix(v, n);
        expect(faixaDaParcela(v * 100, n)).toEqual({ min: faixa.min * 100, max: faixa.max * 100 });
        expect(parcelaSugerida(v * 100, n)).toBe(Math.ceil((v * 1.15) / n) * 100);
        expect(parcelaMinima(v * 100, n)).toBe(Math.ceil(v / n) * 100);
        for (let p = faixa.min; p <= faixa.max; p += 2) {
          casos++;
          const antes = antesPix(v, n, p);
          const agora = calcularRaioXDoPix({ valorCents: v * 100, parcelas: n, parcelaCents: p * 100 });
          if (
            agora.totalPagoCents !== antes.totalPagoCents ||
            agora.jurosCents !== antes.jurosCents ||
            agora.taxaMensalPct !== antes.taxaMensalPct ||
            agora.taxaAnualPct !== antes.taxaAnualPct
          )
            diferentes.push([v, n, p]);
        }
      }
    expect(casos).toBeGreaterThan(50_000);
    expect(diferentes).toEqual([]);
  });

  it('m2-l5 Régua de datas: todas', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const f of regua(1, 28, 1))
      for (const v of regua(1, 28, 1))
        for (const c of regua(1, 30, 1)) {
          casos++;
          const antes = antesDatas(f, v, c);
          const agora = calcularReguaDeDatas({ fechamento: f, vencimento: v, compra: c });
          if (agora.caiNaProxima !== antes.caiNaProxima || agora.diasDeFolego !== antes.diasFolego)
            diferentes.push([f, v, c]);
        }
    expect(casos).toBe(28 * 28 * 30);
    expect(diferentes).toEqual([]);
  });
});

describe('palpites e fronteiras', () => {
  it('m2-l1: meio mês, até um mês, ou mais', () => {
    expect(palpiteCertoDoLimite(11)).toBe('meio-mes');
    expect(palpiteCertoDoLimite(12)).toBe('um-mes');
    expect(palpiteCertoDoLimite(22)).toBe('um-mes');
    expect(palpiteCertoDoLimite(23)).toBe('mais');
    expect(palpitar(IlusaoDePoder, 2)).toContain('Mandou bem!');
    expect(palpitar(IlusaoDePoder, 0)).toContain('Na real: Mais de 22 dias');
  });

  it('m2-l3: o palpite certo é o veredito da conta (os três acontecem)', () => {
    const veredito = (aVistaCents: number, parcelaCents: number, parcelas: number) =>
      palpiteCertoDaCompra(avaliarCompra({ aVistaCents, parcelaCents, parcelas }));
    expect(veredito(90_000, 10_000, 10)).toBe('a-vista');
    expect(veredito(100_000, 10_000, 10)).toBe('parcelado');
    expect(veredito(100_000, 100_000, 1)).toBe('parcelado');
    expect(veredito(1_000, 1_000, 1)).toBe('empate');
    expect(palpitar(emPortugues, 1)).toContain('Mandou bem!');
    expect(palpitar(emPortugues, 0)).toContain('Na real: Pagar à vista compensa');
  });

  it('m2-l4: abaixo de 2%, de 2% a 4%, e caro a partir de 4%', () => {
    expect(palpiteCertoDoPix(0)).toBe('ate-2');
    expect(palpiteCertoDoPix(1.999)).toBe('ate-2');
    expect(palpiteCertoDoPix(2)).toBe('de-2-a-4');
    expect(palpiteCertoDoPix(3.999)).toBe('de-2-a-4');
    expect(palpiteCertoDoPix(4)).toBe('caro');
    expect(palpitar(RaioXDoCetNoPix, 2)).toContain('Mandou bem!');
  });

  it('m2-l5: menos de 14 dias, de 14 a 30, mais de 30', () => {
    expect(palpiteCertoDasDatas(13)).toBe('curto');
    expect(palpiteCertoDasDatas(14)).toBe('medio');
    expect(palpiteCertoDasDatas(30)).toBe('medio');
    expect(palpiteCertoDasDatas(31)).toBe('longo');
    expect(palpitar(ReguaDeDatas, 2)).toContain('Mandou bem!');
  });
});

describe('m2-l1 · Ilusão de poder', () => {
  it('valores de antes: 35 dias, R$ 100,00 por dia útil, e o limite à vista', () => {
    const tela = aberto(IlusaoDePoder);
    expect(limites(tela)).toEqual([
      ['Limite do cartão', 350_000, 50_000, 1_500_000, 25_000],
      ['Sua renda mensal real', 220_000, 120_000, 1_000_000, 10_000],
    ]);
    principalForaDoMais(tela, 'Limite do cartão');
    expect(grande(tela)).toBe('Dias de trabalho pra quitar o limite 35 dias Seu dia útil vale R$ 100,00');
    expect(tudo(tela)).toContain('Valor do seu dia útil R$ 100,00');
    expect(tudo(tela)).toContain('seu limite equivale a 1,6x a sua renda mensal');
    expect(tudo(tela)).toContain('trabalhar 35 dias úteis inteiros');
  });

  it('limite abaixo da renda, inclusive o caso de 1 dia só', () => {
    const tela = aberto(IlusaoDePoder);
    mover(tela, 'Limite do cartão', 50_000);
    expect(tudo(tela)).toContain('seu limite representa 23% da sua renda mensal (5 dias úteis)');
    mover(tela, 'Sua renda mensal real', 1_000_000);
    expect(grande(tela)).toContain('1 dia Seu dia útil');
    expect(tudo(tela)).toContain('(1 dia útil)');
  });
});

describe('m2-l3 · Compensa parcelar', () => {
  it('abre com os valores de antes e dá o mesmo veredito e os mesmos números da calculadora', () => {
    const antes = antesCompra('900,00', '100,00', 10)!;
    const labels = getDictionary('pt-BR').pages.calculators;
    const tela = aberto(emPortugues);
    expect(limites(tela)).toEqual([
      ['Preço à vista', 90_000, 1_000, 2_000_000, 1_000],
      ['Parcelas', 10, 1, 48, 1],
      ['Valor de cada parcela', 10_000, 500, 500_000, 500],
    ]);
    principalForaDoMais(tela, 'Preço à vista');
    expect(grande(tela)).toBe(
      `À vista compensa ${reais(-antes.saldoParcelandoInCents)} é o que você perderia parcelando`,
    );
    const texto = tudo(tela);
    expect(texto).toContain('Parcelado você paga R$ 1.000,00');
    expect(texto).toContain(
      `Juros escondidos R$ 100,00 ${labels.embeddedRate(pct(antes.taxaMes, 2), pct(antes.taxaAno))}`,
    );
    const corpo = plain(
      labels.cashWinsBody(pct(antes.taxaAno), pct(TAXAS_REFERENCIA.cdi), money(-antes.saldoParcelandoInCents)),
    );
    expect(texto).toContain(corpo);
    // A calculadora de /compensa, com os mesmos valores iniciais, diz a mesma coisa.
    expect(tudo(montar(<InstallmentCalculator taxas={TAXAS_REFERENCIA} />))).toContain(corpo);
  });

  it('sem juros: parcelar compensa e os juros aparecem como "nenhum"', () => {
    const tela = aberto(emPortugues);
    mover(tela, 'Preço à vista', 100_000);
    expect(grande(tela)).toContain('Parcelar compensa');
    expect(tudo(tela)).toContain('Juros escondidos nenhum');
    expect(tudo(tela)).toContain('Parcelar compensa, com uma condição:');
  });

  it('empate', () => {
    const tela = aberto(emPortugues);
    mover(tela, 'Preço à vista', 1_000);
    mover(tela, 'Valor de cada parcela', 1_000);
    mover(tela, 'Parcelas', 1);
    expect(grande(tela)).toContain('Dá praticamente na mesma');
  });

  it('a calculadora de /compensa segue com as duas abas e a nota de juntar o dinheiro', () => {
    const html = renderToString(<InstallmentCalculator taxas={TAXAS_REFERENCIA} />);
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toContain('Não tem o dinheiro agora?');
  });
});

describe('m2-l4 · Raio-x do CET no Pix', () => {
  it('valores de antes: mesma taxa, total, juros e CET', () => {
    const antes = antesPix(500, 6, 98);
    const tela = aberto(RaioXDoCetNoPix);
    expect(limites(tela)).toEqual([
      // Fora do passo de R$ 2 contado do mínimo (como antes), a régua aceita o centavo até a pessoa arrastar.
      ['Parcela do banco', 9_800, 8_300, 20_000, 1],
      ['Valor do Pix à vista', 50_000, 10_000, 300_000, 5_000],
      ['Parcelas', 6, 2, 12, 1],
    ]);
    principalForaDoMais(tela, 'Parcela do banco');
    const taxa = antes.taxaMensalPct.toFixed(2).replace('.', ',');
    expect(grande(tela)).toBe(`Taxa mensal implícita ${taxa}% a.m. R$ 88,00 a mais no total`);
    expect(tudo(tela)).toContain(
      `Total pago no Pix R$ 588,00 Juros embutidos R$ 88,00 CET anual equivalente ${antes.taxaAnualPct.toFixed(0)}% a.a.`,
    );
    expect(tudo(tela)).toContain('Pix parcelado caro:');
  });

  it('arrastar a parcela anda de R$ 2 em R$ 2 a partir do mínimo, como antes', () => {
    const tela = aberto(RaioXDoCetNoPix);
    mover(tela, 'Parcela do banco', 9_801);
    expect(reguaDe(tela, 'Parcela do banco').props.value).toBe(9_900);
    expect(reguaDe(tela, 'Parcela do banco').props.step).toBe(200);
  });

  it('trocar o Pix e as parcelas ajusta a parcela como antes, e a régua nunca corta o valor', () => {
    const tela = aberto(RaioXDoCetNoPix);
    mover(tela, 'Valor do Pix à vista', 300_000);
    expect(reguaDe(tela, 'Parcela do banco').props.value).toBe(50_000);
    mover(tela, 'Parcelas', 12);
    expect(reguaDe(tela, 'Parcela do banco').props.value).toBe(28_800);
    mover(tela, 'Valor do Pix à vista', 10_000);
    expect(reguaDe(tela, 'Parcela do banco').props.value).toBe(28_800);
    expect(reguaDe(tela, 'Parcela do banco').props.max).toBe(28_800);
    expect(tudo(tela)).toContain('R$ 3.456,00');
  });

  it('sem juros embutidos', () => {
    const tela = aberto(RaioXDoCetNoPix);
    mover(tela, 'Parcela do banco', 8_300);
    expect(grande(tela)).toBe('Taxa mensal implícita 0,00% a.m. Nada a mais no total');
    expect(tudo(tela)).toContain('Juros embutidos R$ 0,00');
    expect(tudo(tela)).toContain('Compare sempre pelo CET:');
  });
});

describe('m2-l5 · Régua de datas', () => {
  it('valores de antes: 36 dias na próxima fatura', () => {
    const tela = aberto(ReguaDeDatas);
    expect(limites(tela)).toEqual([
      ['Dia da compra no mês', 11, 1, 30, 1],
      ['Fechamento', 10, 1, 28, 1],
      ['Vencimento', 17, 1, 28, 1],
    ]);
    principalForaDoMais(tela, 'Dia da compra no mês');
    expect(grande(tela)).toBe('Fôlego até pagar 36 dias Cai na próxima fatura');
    expect(tudo(tela)).toContain('Melhor janela de compra:');
  });

  it('antes do fechamento cai nesta fatura, inclusive com 1 dia', () => {
    const tela = aberto(ReguaDeDatas);
    mover(tela, 'Dia da compra no mês', 9);
    expect(grande(tela)).toBe('Fôlego até pagar 8 dias Cai na fatura atual');
    mover(tela, 'Vencimento', 10);
    expect(grande(tela)).toContain('1 dia Cai na fatura atual');
    expect(tudo(tela)).toContain('em apenas 1 dia .');
  });
});

describe('Módulo 2 (sem o piloto)', () => {
  it('cada lição abre no SimuladorShell, com 2 ou 3 palpites diferentes, sem emoji e sem régua crua', () => {
    expect(Object.keys(MODULO_2).sort()).toEqual(['m2-l1', 'm2-l3', 'm2-l4', 'm2-l5']);
    for (const [id, Sim] of Object.entries(MODULO_2)) {
      const html = renderToString(<Sim locale="pt-BR" />);
      expect(html, id).toContain('data-simulador-shell');
      const tela = montar(createElement(Sim as () => ReactElement, { locale: 'pt-BR' } as object));
      const palpites = tela.todos((no) => no.props.role === 'radio').map((no) => tela.texto(no));
      expect(palpites.length, id).toBeGreaterThanOrEqual(2);
      expect(palpites.length, id).toBeLessThanOrEqual(3);
      expect(new Set(palpites).size, id).toBe(palpites.length);

      const resultado = aberto(() => <Sim locale="pt-BR" />);
      expect(tudo(resultado), id).not.toMatch(/\p{Extended_Pictographic}/u);
      const cruas = resultado.todos((no) => no.props.type === 'range' && no.props.className !== 'tostao-slider');
      expect(cruas, id).toEqual([]);
    }
  });
});

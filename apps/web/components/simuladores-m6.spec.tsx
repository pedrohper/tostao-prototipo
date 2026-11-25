// T6.15 · módulo 6 no SimuladorShell: a MATEMÁTICA NÃO MUDOU. As funções `antes*` são cópia literal das contas que
// estavam em simulators-m6-m9.tsx (valores em reais); as posições das réguas de antes são comparadas com a conta nova
// (em centavos). Depois, a tela e os palpites.
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import { valorQueCabe } from '@/app/(app)/aprender/[licao]/_simuladores/apoio-m6-m8';
import {
  compararCltPj,
  EquivalenciaCltPj,
  palpiteCertoDoCltPj,
} from '@/app/(app)/aprender/[licao]/_simuladores/clt-vs-pj';
import {
  ajustarOutraFatia,
  FatiadorDecimoTerceiro,
  fatiarDecimoTerceiro,
  palpiteCertoDoDecimo,
} from '@/app/(app)/aprender/[licao]/_simuladores/fatiador-do-13';
import {
  CalculadoraHoleriteReal,
  calcularHolerite,
  palpiteCertoDoHolerite,
} from '@/app/(app)/aprender/[licao]/_simuladores/holerite-real';
import { calcInssCents, calcIrrfCents } from '@/app/(app)/aprender/[licao]/_simuladores/inss-irrf-clt';
import { MODULO_6 } from '@/app/(app)/aprender/[licao]/_simuladores/modulo-6';
import {
  calcularRetornoDasFerias,
  ContaRetornoFerias,
  palpiteCertoDasFerias,
} from '@/app/(app)/aprender/[licao]/_simuladores/retorno-das-ferias';
import {
  calcularSaqueAniversario,
  palpiteCertoDoSaque,
  SaqueAniversarioVsRescisao,
} from '@/app/(app)/aprender/[licao]/_simuladores/saque-aniversario';
import { money } from '@/lib/format';
import { valorEhFrase } from './simulador-shell';
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
  tocar,
  tudo,
} from './simulador.testutil';

const reais = (valor: number) => plain(money(Math.round(valor * 100)));
const opcoes = (Sim: () => ReactNode) => {
  const tela = montar(createElement(Sim as () => ReactElement));
  return tela.todos((no) => no.props.role === 'radio').map((no) => plain(tela.texto(no)));
};

// ---------- As contas de ANTES (cópia literal) ----------

function antesInss(brutoCents: number): number {
  const bruto = brutoCents / 100;
  const faixas: [number, number][] = [
    [1518.0, 0.075],
    [2793.88, 0.09],
    [4190.83, 0.12],
    [8157.41, 0.14],
  ];
  let anterior = 0;
  let total = 0;
  for (const [teto, aliq] of faixas) {
    if (bruto <= anterior) break;
    const base = Math.min(bruto, teto) - anterior;
    total += base * aliq;
    anterior = teto;
  }
  return Math.round(total * 100);
}

function antesIrrf(brutoCents: number, inssCents: number): number {
  const bruto = brutoCents / 100;
  const inss = inssCents / 100;
  // Desconto simplificado mensal (R$ 564,80) vs INSS legal: usa o maior
  const deducao = Math.max(inss, 564.8);
  const base = Math.max(0, bruto - deducao);
  let ir: number;
  if (base <= 2259.2) ir = 0;
  else if (base <= 2826.65) ir = base * 0.075 - 169.44;
  else if (base <= 3751.05) ir = base * 0.15 - 381.44;
  else if (base <= 4664.68) ir = base * 0.225 - 662.77;
  else ir = base * 0.275 - 896.0;
  return Math.max(0, Math.round(ir * 100));
}

function antesHolerite(bruto: number) {
  const brutoCents = bruto * 100;
  const inssCents = antesInss(brutoCents);
  const irrfCents = antesIrrf(brutoCents, inssCents);
  const liquidoCents = brutoCents - inssCents - irrfCents;
  const pctDesconto = (((inssCents + irrfCents) / brutoCents) * 100).toFixed(1).replace('.', ',');
  return { inssCents, irrfCents, liquidoCents, pctDesconto };
}

function antesSaque(bruto: number, anos: number) {
  const depositoMensalCents = Math.round(bruto * 100 * 0.08);
  const saldoFgtsCents = depositoMensalCents * 12 * anos;
  const multa40Cents = Math.round(saldoFgtsCents * 0.4);
  const saqueRescisaoCents = saldoFgtsCents + multa40Cents;
  const saqueAniversarioCents = multa40Cents;
  const travadoCents = saldoFgtsCents;
  return {
    depositoMensalCents,
    saldoFgtsCents,
    multa40Cents,
    saqueRescisaoCents,
    saqueAniversarioCents,
    travadoCents,
  };
}

function antesDecimo(liquido: number, dividas: number, janeiro: number) {
  const festas = Math.max(0, 100 - dividas - janeiro);
  const totalCents = liquido * 100;
  const parc1Cents = Math.round(totalCents * 0.54);
  const parc2Cents = totalCents - parc1Cents;
  const divCents = Math.round((totalCents * dividas) / 100);
  const janCents = Math.round((totalCents * janeiro) / 100);
  const fesCents = totalCents - divCents - janCents;
  return { festas, parc1Cents, parc2Cents, divCents, janCents, fesCents };
}

function antesFerias(salario: number, gastouTudo: boolean) {
  const salCents = salario * 100;
  const tercoCents = Math.round(salCents / 3);
  const entraNaSaidaCents = salCents + tercoCents;
  return { tercoCents, entraNaSaidaCents, saldoCents: gastouTudo ? 0 : salCents };
}

function antesCltPj(cltBruto: number, beneficios: number, pjMensal: number) {
  const cltBrutoCents = cltBruto * 100;
  const inss = antesInss(cltBrutoCents);
  const irrf = antesIrrf(cltBrutoCents, inss);
  const cltLiqMensal = cltBrutoCents - inss - irrf;

  const fgtsAnual = Math.round(cltBrutoCents * 0.08 * 13.33);
  const cltAnualCents =
    cltLiqMensal * 12 + cltLiqMensal + Math.round(cltLiqMensal / 3) + fgtsAnual + beneficios * 100 * 12;

  const pjBrutoAnual = pjMensal * 100 * 11;
  const pjDas = Math.round(pjBrutoAnual * 0.06);
  const pjContador = 200 * 100 * 12;
  const pjAnualCents = Math.max(0, pjBrutoAnual - pjDas - pjContador);

  const diffAnual = pjAnualCents - cltAnualCents;
  return { cltAnualCents, pjAnualCents, diffAnual };
}

// ---------- (a) A matemática ----------

describe('módulo 6: a matemática não mudou', () => {
  it('INSS e IRRF: valores quebrados da régua inteira e as fronteiras das faixas', () => {
    const valores = regua(150_000, 1_500_000, 97);
    // Tetos do INSS e, com o desconto simplificado ou o próprio INSS, as viradas de base do IRRF.
    for (const virada of [151_800, 279_388, 419_083, 815_741, 282_400, 338_850, 431_000, 522_948, 150_000, 1_500_000])
      valores.push(...regua(virada - 300, virada + 300, 1));
    const diferentes = valores.filter((cents) => {
      const inss = antesInss(cents);
      return calcInssCents(cents) !== inss || calcIrrfCents(cents, inss) !== antesIrrf(cents, inss);
    });
    expect(valores.length).toBeGreaterThan(19_000);
    expect(diferentes).toEqual([]);
  });

  it('m6-l1 Holerite: todas as posições', () => {
    const posicoes = regua(1500, 15000, 100);
    expect(posicoes).toHaveLength(136);
    for (const bruto of posicoes) {
      const antes = antesHolerite(bruto);
      const agora = calcularHolerite({ brutoCents: bruto * 100 });
      expect([agora.inssCents, agora.irrfCents, agora.liquidoCents], String(bruto)).toEqual([
        antes.inssCents,
        antes.irrfCents,
        antes.liquidoCents,
      ]);
      expect(agora.descontoPct.toFixed(1).replace('.', ',')).toBe(antes.pctDesconto);
    }
  });

  it('m6-l2 Saque-aniversário: todas as posições', () => {
    let casos = 0;
    for (const bruto of regua(1500, 12000, 100))
      for (const anos of [1, 2, 3, 4, 5]) {
        casos++;
        expect(calcularSaqueAniversario({ brutoCents: bruto * 100, anos })).toEqual(antesSaque(bruto, anos));
      }
    expect(casos).toBe(106 * 5);
  });

  it('m6-l3 13º: todas as posições alcançáveis (as duas fatias somam no máximo 100%)', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const liquido of regua(1000, 10000, 100))
      for (const d of regua(0, 100, 5))
        for (const j of regua(0, 100 - d, 5)) {
          casos++;
          const antes = antesDecimo(liquido, d, j);
          const agora = fatiarDecimoTerceiro({ liquidoCents: liquido * 100, dividasPct: d, janeiroPct: j });
          const novo = [
            agora.festasPct,
            agora.parc1Cents,
            agora.parc2Cents,
            agora.dividasCents,
            agora.janeiroCents,
            agora.festasCents,
          ];
          if (JSON.stringify(novo) !== JSON.stringify(Object.values(antes))) diferentes.push([liquido, d, j]);
        }
    expect(casos).toBe(91 * 231);
    expect(diferentes).toEqual([]);
  });

  it('m6-l3 13º digitado com centavos quebrados nunca deixa festa negativa', () => {
    const r = fatiarDecimoTerceiro({ liquidoCents: 100_001, dividasPct: 50, janeiroPct: 50 });
    expect(r.festasCents).toBe(0);
    expect(r.dividasCents + r.janeiroCents).toBe(100_001);
  });

  it('m6-l4 Férias: todas as posições', () => {
    for (const salario of regua(1500, 10000, 100))
      for (const gastouTudo of [true, false]) {
        const antes = antesFerias(salario, gastouTudo);
        expect(calcularRetornoDasFerias({ salarioCents: salario * 100, gastouTudo })).toEqual({
          tercoCents: antes.tercoCents,
          entraNaSaidaCents: antes.entraNaSaidaCents,
          saldoNaVoltaCents: antes.saldoCents,
        });
      }
  });

  it('m6-l5 CLT x PJ: todas as posições', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const c of regua(2000, 15000, 250))
      for (const b of regua(0, 2500, 100))
        for (const p of regua(2000, 25000, 250)) {
          casos++;
          const antes = antesCltPj(c, b, p);
          const agora = compararCltPj({ cltBrutoCents: c * 100, beneficiosCents: b * 100, pjMensalCents: p * 100 });
          if (
            agora.cltAnualCents !== antes.cltAnualCents ||
            agora.pjAnualCents !== antes.pjAnualCents ||
            agora.diffAnualCents !== antes.diffAnual
          )
            diferentes.push([c, b, p]);
        }
    expect(casos).toBe(53 * 26 * 93);
    expect(diferentes).toEqual([]);
  });
});

// ---------- (b) A tela ----------

describe('m6-l1 · Holerite real', () => {
  it('mesma régua, sem "Ajustar mais"', () => {
    const tela = aberto(CalculadoraHoleriteReal);
    expect(limites(tela)).toEqual([['Salário bruto CLT', 350_000, 150_000, 1_500_000, 10_000]]);
    expect(tela.todos((no) => no.tag === 'details')).toEqual([]);
  });

  it('valores didáticos e depois de mexer', () => {
    const tela = aberto(CalculadoraHoleriteReal);
    expect(grande(tela)).toBe('Líquido real que cai na conta R$ 3.127,75 −10,6% de descontos');
    expect(tudo(tela)).toContain('INSS progressivo −R$ 313,41');
    expect(tudo(tela)).toContain('IRRF na fonte −R$ 58,84');
    expect(tudo(tela)).toContain('O INSS é cobrado por faixas (como uma escada)');
    mover(tela, 'Salário bruto CLT', 920_000);
    const antes = antesHolerite(9200);
    expect(grande(tela)).toContain(plain(money(antes.liquidoCents)));
    expect(grande(tela)).toContain(`−${antes.pctDesconto}% de descontos`);
  });
});

describe('m6-l2 · Saque-aniversário', () => {
  it('mesmas réguas (anos vira régua de 1 a 5) e o salário como controle principal', () => {
    const tela = aberto(SaqueAniversarioVsRescisao);
    expect(limites(tela)).toEqual([
      ['Salário bruto', 300_000, 150_000, 1_200_000, 10_000],
      ['Tempo de empresa', 3, 1, 5, 1],
    ]);
    principalForaDoMais(tela, 'Salário bruto');
  });

  it('valores didáticos e depois de mexer', () => {
    const tela = aberto(SaqueAniversarioVsRescisao);
    expect(grande(tela)).toContain('R$ 3.456,00 Só a multa. R$ 8.640,00 do saldo ficam retidos');
    const t = tudo(tela);
    expect(t).toContain('Saque-Rescisão R$ 12.096,00 Saldo + multa de 40%');
    expect(t).toContain('Saque-Aniversário R$ 3.456,00 Só a multa na demissão');
    expect(t).toContain('voltar para o Saque-Rescisão leva 25 meses');
    expect(t).toContain('Saldo acumulado de FGTS (8%/mês): R$ 8.640,00 + Multa de 40%: R$ 3.456,00');
    mover(tela, 'Salário bruto', 710_000);
    mover(tela, 'Tempo de empresa', 5);
    expect(grande(tela)).toContain(plain(money(antesSaque(7100, 5).multa40Cents)));
    expect(tudo(tela)).toContain('5 anos de empresa');
  });
});

describe('m6-l3 · Fatiador do 13º', () => {
  it('mesmas réguas e uma fatia como controle principal', () => {
    const tela = aberto(FatiadorDecimoTerceiro);
    expect(limites(tela)).toEqual([
      ['Janeiro (IPVA, matrícula, material)', 30, 0, 100, 5],
      ['Quitar dívidas / cartão', 50, 0, 100, 5],
      ['13º líquido total', 280_000, 100_000, 1_000_000, 10_000],
    ]);
    principalForaDoMais(tela, 'Janeiro (IPVA, matrícula, material)');
  });

  it('valores didáticos', () => {
    const tela = aberto(FatiadorDecimoTerceiro);
    expect(grande(tela)).toBe('Sobra pras festas R$ 560,00 20% do 13º');
    const t = tudo(tela);
    expect(t).toContain('1ª parcela (nov): ~ R$ 1.512,00 · 2ª parcela (dez, com descontos): ~ R$ 1.288,00');
    expect(t).toContain('Dívidas R$ 1.400,00 Janeiro R$ 840,00 Festas (20%) R$ 560,00');
  });

  it('quando as fatias passam de 100%, a outra encolhe (nos dois sentidos)', () => {
    const tela = aberto(FatiadorDecimoTerceiro);
    mover(tela, 'Janeiro (IPVA, matrícula, material)', 80);
    expect(reguaDe(tela, 'Quitar dívidas / cartão').props.value).toBe(20);
    mover(tela, 'Quitar dívidas / cartão', 65);
    expect(reguaDe(tela, 'Janeiro (IPVA, matrícula, material)').props.value).toBe(35);
    expect(grande(tela)).toContain('R$ 0,00 0% do 13º');
    mover(tela, 'Quitar dívidas / cartão', 10);
    expect(reguaDe(tela, 'Janeiro (IPVA, matrícula, material)').props.value).toBe(35);
    expect(grande(tela)).toContain(plain(money(antesDecimo(2800, 10, 35).fesCents)));
    expect(ajustarOutraFatia(60, 30)).toBe(30);
    expect(ajustarOutraFatia(80, 30)).toBe(20);
  });
});

describe('m6-l4 · Retorno das férias', () => {
  it('a escolha é o controle principal e o salário fica em "Ajustar mais" com a mesma régua', () => {
    const tela = aberto(ContaRetornoFerias);
    expect(limites(tela)).toEqual([['Salário mensal líquido', 300_000, 150_000, 1_000_000, 10_000]]);
    principalForaDoMais(tela, 'O que fazer com o dinheiro das férias');
  });

  it('gastando tudo e guardando, os números e avisos de antes', () => {
    const tela = aberto(ContaRetornoFerias);
    expect(grande(tela)).toBe('Saldo no mês de volta R$ 0,00 Buraco no orçamento!');
    expect(tudo(tela)).toContain('Adiantamento + 1/3 R$ 4.000,00 Extra real é só R$ 1.000,00');
    expect(tudo(tela)).toContain('Se você gastar os R$ 4.000,00 viajando');
    tocar(tela, 'Guardar o adiantamento');
    expect(grande(tela)).toBe('Saldo no mês de volta R$ 3.000,00 Contas do mês cobertas');
    expect(tudo(tela)).toContain('Separando R$ 3.000,00 para o mês seguinte');
    mover(tela, 'Salário mensal líquido', 550_000);
    expect(grande(tela)).toContain(plain(money(antesFerias(5500, false).saldoCents)));
  });
});

describe('m6-l5 · CLT x PJ', () => {
  it('mesmas réguas e a proposta PJ como controle principal', () => {
    const tela = aberto(EquivalenciaCltPj);
    expect(limites(tela)).toEqual([
      ['Proposta PJ mensal', 750_000, 200_000, 2_500_000, 25_000],
      ['Salário bruto CLT', 500_000, 200_000, 1_500_000, 25_000],
      ['Benefícios CLT (VR/VA/Saúde por mês)', 80_000, 0, 250_000, 10_000],
    ]);
    principalForaDoMais(tela, 'Proposta PJ mensal');
  });

  it('valores didáticos: PJ paga R$ 4.814,67 a mais', () => {
    const tela = aberto(EquivalenciaCltPj);
    expect(grande(tela)).toContain('O PJ paga a mais por ano R$ 4.814,67');
    const t = tudo(tela);
    expect(t).toContain('CLT líquido/ano R$ 70.335,33');
    expect(t).toContain('PJ líquido/ano R$ 75.150,00');
    expect(t).toContain('~R$ 5.861,28/mês');
    expect(t).toContain('~R$ 6.262,50/mês');
    expect(t).toContain('considerando 11 meses trabalhados, 6% de DAS e R$ 200/mês de contador');
  });

  it('quando a CLT vence, a frase de antes', () => {
    const tela = aberto(EquivalenciaCltPj);
    mover(tela, 'Proposta PJ mensal', 400_000);
    const antes = antesCltPj(5000, 800, 4000);
    expect(antes.diffAnual).toBeLessThan(0);
    const falta = reais(Math.abs(antes.diffAnual) / 100);
    expect(grande(tela)).toContain(`A CLT vence por ano ${falta}`);
    expect(tudo(tela)).toContain(`A CLT vence por ${falta}/ano quando somamos 13º, 1/3 de férias, FGTS e benefícios.`);
  });
});

describe('o número grande cabe em 320 px', () => {
  it('valor curto fica sozinho; com 12 caracteres ou mais ganha o complemento e vai pra letra menor', () => {
    expect(valorQueCabe(money(864_000), 'na conta')).toBe(money(864_000));
    const longo = valorQueCabe(money(1_108_107), 'na conta');
    expect(plain(longo)).toBe('R$ 11.081,07 na conta');
    expect(valorEhFrase(longo)).toBe(true);
    const tela = aberto(CalculadoraHoleriteReal);
    mover(tela, 'Salário bruto CLT', 1_500_000);
    expect(grande(tela)).toContain(`${reais(antesHolerite(15000).liquidoCents / 100)} na conta`);
  });
});

// ---------- (c) Os palpites ----------

describe('módulo 6: palpites', () => {
  it('fronteiras do holerite: 90% e 80% do bruto', () => {
    expect(palpiteCertoDoHolerite(100_000, 90_001)).toBe('mais');
    expect(palpiteCertoDoHolerite(100_000, 90_000)).toBe('meio');
    expect(palpiteCertoDoHolerite(100_000, 80_000)).toBe('meio');
    expect(palpiteCertoDoHolerite(100_000, 79_999)).toBe('menos');
  });

  it('saque: compara com os três palpites; na régua inteira é sempre só a multa, sem opção repetida', () => {
    const base = { saqueRescisaoCents: 140, travadoCents: 100 };
    expect(palpiteCertoDoSaque({ ...base, saqueAniversarioCents: 140 })).toBe('tudo');
    expect(palpiteCertoDoSaque({ ...base, saqueAniversarioCents: 100 })).toBe('saldo');
    expect(palpiteCertoDoSaque({ ...base, saqueAniversarioCents: 40 })).toBe('multa');
    for (const bruto of regua(150_000, 1_200_000, 10_000)) {
      const r = calcularSaqueAniversario({ brutoCents: bruto, anos: 1 });
      expect(palpiteCertoDoSaque(r)).toBe('multa');
      expect(new Set([r.multa40Cents, r.saldoFgtsCents, r.saqueRescisaoCents]).size).toBe(3);
    }
  });

  it('13º: nada, até um quarto, mais que um quarto', () => {
    expect(palpiteCertoDoDecimo(100_000, 0)).toBe('nada');
    expect(palpiteCertoDoDecimo(100_000, 1)).toBe('ate');
    expect(palpiteCertoDoDecimo(100_000, 25_000)).toBe('ate');
    expect(palpiteCertoDoDecimo(100_000, 25_001)).toBe('mais');
  });

  it('férias: nada, só uma parte ou o salário', () => {
    expect(palpiteCertoDasFerias(300_000, 0)).toBe('nada');
    expect(palpiteCertoDasFerias(300_000, 100_000)).toBe('terco');
    expect(palpiteCertoDasFerias(300_000, 300_000)).toBe('salario');
  });

  it('CLT x PJ: empate conta pro PJ', () => {
    expect(palpiteCertoDoCltPj(0)).toBe('pj');
    expect(palpiteCertoDoCltPj(1)).toBe('pj');
    expect(palpiteCertoDoCltPj(-1)).toBe('clt');
  });

  it.each([
    ['m6-l1', CalculadoraHoleriteReal, 1],
    ['m6-l2', SaqueAniversarioVsRescisao, 0],
    ['m6-l3', FatiadorDecimoTerceiro, 2],
    ['m6-l4', ContaRetornoFerias, 0],
    ['m6-l5', EquivalenciaCltPj, 1],
  ] as const)('%s: sem opção repetida e a certa nos valores didáticos', (_id, Sim, certa) => {
    const lista = opcoes(Sim);
    expect(lista.length).toBeGreaterThanOrEqual(2);
    expect(new Set(lista).size).toBe(lista.length);
    expect(palpitar(Sim, certa)).toContain('Mandou bem!');
    expect(palpitar(Sim, (certa + 1) % lista.length)).toContain('Boa tentativa!');
  });
});

describe('o mapa do módulo 6', () => {
  it('tem as 5 lições e todas abrem no SimuladorShell, no palpite', () => {
    expect(Object.keys(MODULO_6)).toEqual(['m6-l1', 'm6-l2', 'm6-l3', 'm6-l4', 'm6-l5']);
    for (const [id, Sim] of Object.entries(MODULO_6)) {
      const html = renderToString(<Sim locale="pt-BR" />);
      expect(html, id).toContain('data-simulador-shell');
      expect(html, id).toContain('role="radiogroup"');
      expect(html, id).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

// T6.15 · módulo 7 no SimuladorShell: a MATEMÁTICA NÃO MUDOU. As funções `antes*` são cópia literal das contas que
// estavam em simulators-m6-m9.tsx (valores em reais); todas as posições das réguas de antes são comparadas com a conta
// nova (em centavos). Depois, a tela e os palpites.
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import {
  CalculadoraCDI,
  calcularCdi,
  palpiteCertoDoCdi,
} from '@/app/(app)/aprender/[licao]/_simuladores/calculadora-do-cdi';
import {
  CalculadoraGanhoReal,
  calcularGanhoReal,
  palpiteCertoDoGanhoReal,
} from '@/app/(app)/aprender/[licao]/_simuladores/ganho-real';
import {
  calcularGarantiaFgc,
  palpiteCertoDoFgc,
  RaioXGarantiaFGC,
} from '@/app/(app)/aprender/[licao]/_simuladores/garantia-fgc';
import {
  MapaDoTesouro,
  palpiteCertoDoTesouro,
  projetarTesouro,
} from '@/app/(app)/aprender/[licao]/_simuladores/mapa-do-tesouro';
import { MODULO_7 } from '@/app/(app)/aprender/[licao]/_simuladores/modulo-7';
import {
  calcularMordidaDoLeao,
  faixasDoLeao,
  MordidaLeaoResgate,
  palpiteCertoDoLeao,
} from '@/app/(app)/aprender/[licao]/_simuladores/mordida-do-leao';
import { money } from '@/lib/format';
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
  tocar,
  tudo,
} from './simulador.testutil';

const dinheiro = (cents: number) => plain(money(cents));
const opcoes = (Sim: () => ReactNode) => {
  const tela = montar(createElement(Sim as () => ReactElement));
  return tela.todos((no) => no.props.role === 'radio').map((no) => plain(tela.texto(no)));
};

// ---------- As contas de ANTES (cópia literal) ----------

function antesCdi(valor: number, meses: number) {
  const dias = meses * 30;
  const irAliquota = dias <= 180 ? 0.225 : dias <= 360 ? 0.2 : dias <= 720 ? 0.175 : 0.15;

  const taxaCdiAnual = 0.1115;
  const taxaPoupancaAnual = 0.0717; // 6,17% + TR ~1%

  const brutoCdb = valor * Math.pow(1 + taxaCdiAnual, meses / 12);
  const lucroBrutoCdb = brutoCdb - valor;
  const liqCdbCents = Math.round((valor + lucroBrutoCdb * (1 - irAliquota)) * 100);

  const liqPoupCents = Math.round(valor * Math.pow(1 + taxaPoupancaAnual, meses / 12) * 100);
  const diferencaCents = liqCdbCents - liqPoupCents;
  return { irAliquota, liqCdbCents, liqPoupCents, diferencaCents };
}

function antesFgc(b1: number, b2: number, b3: number) {
  const LIMITE_BANCO = 250000;
  const TETO_GLOBAL = 1000000;
  const bancos = [{ valor: b1 }, { valor: b2 }, { valor: b3 }];
  const total = b1 + b2 + b3;
  const cobertoPorBanco = bancos.reduce((acc, b) => acc + Math.min(b.valor, LIMITE_BANCO), 0);
  const cobertoTotal = Math.min(cobertoPorBanco, TETO_GLOBAL);
  const descoberto = total - cobertoTotal;
  return { total, cobertoTotal, descoberto };
}

function antesLeao(valor: number) {
  const taxaAnual = 0.1115;
  const cenarios = [
    { label: 'Dia 15', dias: 15, iof: 0.5, ir: 0.225 },
    { label: 'Dia 181', dias: 181, iof: 0, ir: 0.2 },
    { label: 'Dia 721', dias: 721, iof: 0, ir: 0.15 },
  ];
  return cenarios.map((c) => {
    const bruto = valor * Math.pow(1 + taxaAnual, c.dias / 365);
    const lucroBruto = bruto - valor;
    const descIof = lucroBruto * c.iof;
    const descIr = (lucroBruto - descIof) * c.ir;
    const impostoTotalCents = Math.round((descIof + descIr) * 100);
    const lucroLiqCents = Math.round((lucroBruto - descIof - descIr) * 100);
    return { ...c, impostoTotalCents, lucroLiqCents };
  });
}

const antesTesouro = (retornoEstimado: number, anos: number) =>
  Math.round(1000 * Math.pow(1 + retornoEstimado, anos) * 100);

function antesGanhoReal(nominal: number, ipca: number) {
  const real = ((1 + nominal / 100) / (1 + ipca / 100) - 1) * 100;
  const baseCents = 10000 * 100;
  const poderCompra1AnoCents = Math.round(baseCents * (1 + real / 100));
  const poderCompra5AnosCents = Math.round(baseCents * Math.pow(1 + real / 100, 5));
  return { real, poderCompra1AnoCents, poderCompra5AnosCents };
}

// ---------- (a) A matemática ----------

describe('módulo 7: a matemática não mudou (todas as posições das réguas de antes)', () => {
  it('m7-l1 CDI', () => {
    let casos = 0;
    for (const valor of regua(500, 20000, 500))
      for (const meses of regua(3, 60, 3)) {
        casos++;
        const antes = antesCdi(valor, meses);
        expect(calcularCdi({ valorCents: valor * 100, meses })).toEqual({
          irAliquota: antes.irAliquota,
          liqCdbCents: antes.liqCdbCents,
          liqPoupancaCents: antes.liqPoupCents,
          diferencaCents: antes.diferencaCents,
        });
      }
    expect(casos).toBe(40 * 20);
  });

  it('m7-l2 FGC', () => {
    const posicoes = regua(0, 500_000, 10_000);
    let casos = 0;
    const diferentes: number[][] = [];
    for (const a of posicoes)
      for (const b of posicoes)
        for (const c of posicoes) {
          casos++;
          const antes = antesFgc(a, b, c);
          const agora = calcularGarantiaFgc({ bancosCents: [a * 100, b * 100, c * 100] });
          if (
            agora.totalCents !== antes.total * 100 ||
            agora.cobertoCents !== antes.cobertoTotal * 100 ||
            agora.descobertoCents !== antes.descoberto * 100
          )
            diferentes.push([a, b, c]);
        }
    expect(casos).toBe(51 ** 3);
    expect(diferentes).toEqual([]);
  });

  it('m7-l3 Mordida do Leão', () => {
    for (const valor of regua(1000, 20000, 500)) {
      const antes = antesLeao(valor);
      const agora = calcularMordidaDoLeao({ valorCents: valor * 100 });
      expect(agora.map((c) => [c.label, c.dias, c.iof, c.ir, c.impostoCents, c.lucroLiqCents])).toEqual(
        antes.map((c) => [c.label, c.dias, c.iof, c.ir, c.impostoTotalCents, c.lucroLiqCents]),
      );
      for (const c of agora) expect(c.lucroBrutoCents).toBe(c.impostoCents + c.lucroLiqCents);
    }
  });

  it('m7-l4 Tesouro: os três prazos', () => {
    expect(projetarTesouro({ objetivo: 'curto' }).projecaoCents).toBe(antesTesouro(0.1125, 1));
    expect(projetarTesouro({ objetivo: 'medio' }).projecaoCents).toBe(antesTesouro(0.12, 3));
    expect(projetarTesouro({ objetivo: 'longo' }).projecaoCents).toBe(antesTesouro(0.107, 10));
  });

  it('m7-l5 Ganho real', () => {
    let casos = 0;
    for (const nominal of regua(4, 20, 0.5))
      for (const ipca of regua(2, 15, 0.5)) {
        casos++;
        const antes = antesGanhoReal(nominal, ipca);
        expect(calcularGanhoReal({ nominalPct: nominal, ipcaPct: ipca })).toEqual({
          realPct: antes.real,
          em1AnoCents: antes.poderCompra1AnoCents,
          em5AnosCents: antes.poderCompra5AnosCents,
        });
      }
    expect(casos).toBe(33 * 27);
  });
});

// ---------- (b) A tela ----------

describe('m7-l1 · Calculadora do CDI', () => {
  it('mesmas réguas e o valor como controle principal', () => {
    const tela = aberto(CalculadoraCDI);
    expect(limites(tela)).toEqual([
      ['Valor aplicado', 100_000, 50_000, 2_000_000, 50_000],
      ['Prazo', 12, 3, 60, 3],
    ]);
    principalForaDoMais(tela, 'Valor aplicado');
  });

  it('valores didáticos e depois de mexer', () => {
    const tela = aberto(CalculadoraCDI);
    expect(grande(tela)).toContain('O CDB deixa a mais no seu bolso R$ 17,50');
    const t = tudo(tela);
    expect(t).toContain('CDB 100% CDI (líquido) R$ 1.089,20 ~11,15% a.a. − IR');
    expect(t).toContain('Poupança (isenta) R$ 1.071,70 ~6,17% + TR');
    expect(t).toContain('o CDB 100% CDI coloca R$ 17,50 a mais no seu bolso');
    expect(t).toContain('IR 20,0%');
    mover(tela, 'Valor aplicado', 1_500_000);
    mover(tela, 'Prazo', 48);
    expect(grande(tela)).toContain(dinheiro(antesCdi(15000, 48).diferencaCents));
    expect(tudo(tela)).toContain('IR 15,0%');
  });
});

describe('m7-l2 · Raio-x do FGC', () => {
  it('mesmas réguas (em centavos) e um banco como controle principal', () => {
    const tela = aberto(RaioXGarantiaFGC);
    expect(limites(tela)).toEqual([
      ['Banco B', 28_000_000, 0, 50_000_000, 1_000_000],
      ['Banco A', 18_000_000, 0, 50_000_000, 1_000_000],
      ['Banco C', 15_000_000, 0, 50_000_000, 1_000_000],
    ]);
    principalForaDoMais(tela, 'Banco B');
  });

  it('valores didáticos: R$ 30 mil sem garantia, com o aviso de antes', () => {
    const tela = aberto(RaioXGarantiaFGC);
    expect(grande(tela)).toContain('Sem garantia (risco) R$ 30.000,00 R$ 580.000,00 protegidos pelo FGC');
    const t = tudo(tela);
    expect(t).toContain('Banco B R$ 280.000,00 Acima de R$ 250 mil!');
    expect(t).toContain('Você tem R$ 30.000,00 acima do limite de R$ 250 mil por instituição.');
  });

  it('tudo coberto e acima do teto global', () => {
    const tela = aberto(RaioXGarantiaFGC);
    mover(tela, 'Banco B', 20_000_000);
    expect(grande(tela)).toContain('Sem garantia (risco) R$ 0,00');
    expect(tudo(tela)).toContain('Tudo coberto! Nenhum banco passa de R$ 250 mil');
    expect(tudo(tela)).not.toContain('Acima de R$ 250 mil!');
    mover(tela, 'Banco A', 50_000_000);
    mover(tela, 'Banco B', 50_000_000);
    mover(tela, 'Banco C', 50_000_000);
    expect(grande(tela)).toContain(dinheiro(antesFgc(500_000, 500_000, 500_000).descoberto * 100));
    expect(tudo(tela)).toContain('você ultrapassou o teto global de R$ 1 milhão');
  });
});

describe('m7-l3 · Mordida do Leão', () => {
  it('mesma régua, sem "Ajustar mais"', () => {
    const tela = aberto(MordidaLeaoResgate);
    expect(limites(tela)).toEqual([['Aplicação inicial (CDB 100% CDI)', 100_000, 100_000, 2_000_000, 50_000]]);
    expect(tela.todos((no) => no.tag === 'details')).toEqual([]);
  });

  it('os três resgates com os números de antes', () => {
    const tela = aberto(MordidaLeaoResgate);
    expect(grande(tela)).toContain('No dia 15, o Leão leva R$ 2,67 Sobram R$ 1,69 de lucro pra você');
    for (const valorCents of [100_000, 1_250_000]) {
      mover(tela, 'Aplicação inicial (CDB 100% CDI)', valorCents);
      for (const c of antesLeao(valorCents / 100)) {
        expect(tudo(tela)).toContain(
          `${c.label} · IOF ${(c.iof * 100).toFixed(0)}% · IR ${(c.ir * 100).toFixed(1).replace('.', ',')}% +${dinheiro(c.lucroLiqCents)} Leão levou ${dinheiro(c.impostoTotalCents)}`,
        );
      }
    }
  });
});

describe('m7-l4 · Mapa do Tesouro', () => {
  it('a escolha do prazo é o controle (sem régua e sem "Ajustar mais")', () => {
    const tela = aberto(MapaDoTesouro);
    expect(limites(tela)).toEqual([]);
    expect(tela.todos((no) => no.tag === 'details')).toEqual([]);
    expect(tela.todos((no) => no.props.role === 'radio')).toHaveLength(3);
  });

  it('cada prazo mostra o título, a taxa, o motivo e a projeção de antes', () => {
    const tela = aberto(MapaDoTesouro);
    expect(grande(tela)).toBe('O título que combina Tesouro Selic 1 ano / Reserva de emergência');
    expect(tudo(tela)).toContain('Selic (~11,25% a.a.)');
    expect(tudo(tela)).toContain(`Projeção bruta de R$ 1.000,00 em 1 ano ${dinheiro(antesTesouro(0.1125, 1))}`);
    tocar(tela, '3 anos (Meta)');
    expect(grande(tela)).toContain('Tesouro Prefixado 3 anos / Meta com data marcada');
    expect(tudo(tela)).toContain('marcação a mercado');
    expect(tudo(tela)).toContain(`em 3 anos ${dinheiro(antesTesouro(0.12, 3))}`);
    tocar(tela, '10 anos (Futuro)');
    expect(grande(tela)).toContain('Tesouro IPCA+ 10 anos / Aposentadoria e longo prazo');
    expect(tudo(tela)).toContain('Inflação + ~6,2% a.a.');
    expect(tudo(tela)).toContain(`em 10 anos ${dinheiro(antesTesouro(0.107, 10))}`);
  });
});

describe('m7-l5 · Ganho real', () => {
  it('mesmas réguas e o rendimento como controle principal', () => {
    const tela = aberto(CalculadoraGanhoReal);
    expect(limites(tela)).toEqual([
      ['Rentabilidade nominal (% a.a.)', 11.5, 4, 20, 0.5],
      ['Inflação IPCA (% a.a.)', 4.5, 2, 15, 0.5],
    ]);
    principalForaDoMais(tela, 'Rentabilidade nominal');
  });

  it('valores didáticos e ganho negativo', () => {
    const tela = aberto(CalculadoraGanhoReal);
    const antes = antesGanhoReal(11.5, 4.5);
    expect(grande(tela)).toBe('Ganho real (Fórmula de Fisher) +6,70% ao ano');
    expect(tudo(tela)).toContain(`R$ 10 mil em 1 ano ${dinheiro(antes.poderCompra1AnoCents)} em poder de compra`);
    expect(tudo(tela)).toContain(`R$ 10 mil em 5 anos ${dinheiro(antes.poderCompra5AnosCents)} em poder de compra`);
    mover(tela, 'Rentabilidade nominal (% a.a.)', 6);
    mover(tela, 'Inflação IPCA (% a.a.)', 10);
    expect(grande(tela)).toContain(`${antesGanhoReal(6, 10).real.toFixed(2).replace('.', ',')}% ao ano`);
    expect(grande(tela)).toContain('-3,64% ao ano');
  });
});

// ---------- (c) Os palpites ----------

describe('módulo 7: palpites', () => {
  it('CDI: poupança, por pouco (menos de 1%) ou por mais', () => {
    expect(palpiteCertoDoCdi(100_000, 0)).toBe('poupanca');
    expect(palpiteCertoDoCdi(100_000, 999)).toBe('pouco');
    expect(palpiteCertoDoCdi(100_000, 1_000)).toBe('mais');
  });

  it('FGC: nada, até R$ 100 mil ou mais', () => {
    expect(palpiteCertoDoFgc(0)).toBe('nada');
    expect(palpiteCertoDoFgc(1)).toBe('ate');
    expect(palpiteCertoDoFgc(10_000_000)).toBe('ate');
    expect(palpiteCertoDoFgc(10_000_001)).toBe('mais');
  });

  it('Leão: 35% e 90% do lucro; no dia 15 é sempre a mordida grande, sem fronteiras repetidas', () => {
    expect(palpiteCertoDoLeao(1_000, 350)).toBe('pouco');
    expect(palpiteCertoDoLeao(1_000, 351)).toBe('metade');
    expect(palpiteCertoDoLeao(1_000, 899)).toBe('metade');
    expect(palpiteCertoDoLeao(1_000, 900)).toBe('tudo');
    for (const valorCents of regua(100_000, 2_000_000, 50_000)) {
      const dia15 = calcularMordidaDoLeao({ valorCents })[0]!;
      const { poucoCents, quaseTudoCents } = faixasDoLeao(dia15.lucroBrutoCents);
      expect(poucoCents).toBeLessThan(quaseTudoCents);
      expect(palpiteCertoDoLeao(dia15.lucroBrutoCents, dia15.impostoCents)).toBe('metade');
    }
  });

  it('Tesouro: um título por prazo', () => {
    expect(palpiteCertoDoTesouro('curto')).toBe('selic');
    expect(palpiteCertoDoTesouro('medio')).toBe('prefixado');
    expect(palpiteCertoDoTesouro('longo')).toBe('ipca');
  });

  it('Ganho real: nada, menos que o rendimento ou o rendimento inteiro', () => {
    expect(palpiteCertoDoGanhoReal(10, -0.01)).toBe('nada');
    expect(palpiteCertoDoGanhoReal(10, 0)).toBe('nada');
    expect(palpiteCertoDoGanhoReal(10, 9.99)).toBe('menos');
    expect(palpiteCertoDoGanhoReal(10, 10)).toBe('tudo');
  });

  it.each([
    ['m7-l1', CalculadoraCDI, 2],
    ['m7-l2', RaioXGarantiaFGC, 1],
    ['m7-l3', MordidaLeaoResgate, 1],
    ['m7-l4', MapaDoTesouro, 0],
    ['m7-l5', CalculadoraGanhoReal, 2],
  ] as const)('%s: sem opção repetida e a certa nos valores didáticos', (_id, Sim, certa) => {
    const lista = opcoes(Sim);
    expect(lista.length).toBeGreaterThanOrEqual(2);
    expect(new Set(lista).size).toBe(lista.length);
    expect(palpitar(Sim, certa)).toContain('Mandou bem!');
    expect(palpitar(Sim, (certa + 1) % lista.length)).toContain('Boa tentativa!');
  });
});

describe('o mapa do módulo 7', () => {
  it('tem as 5 lições e todas abrem no SimuladorShell, no palpite', () => {
    expect(Object.keys(MODULO_7)).toEqual(['m7-l1', 'm7-l2', 'm7-l3', 'm7-l4', 'm7-l5']);
    for (const [id, Sim] of Object.entries(MODULO_7)) {
      const html = renderToString(<Sim locale="pt-BR" />);
      expect(html, id).toContain('data-simulador-shell');
      expect(html, id).toContain('role="radiogroup"');
      expect(html, id).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

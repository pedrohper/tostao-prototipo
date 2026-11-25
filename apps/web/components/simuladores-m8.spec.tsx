// T6.15 · módulo 8 no SimuladorShell: a MATEMÁTICA NÃO MUDOU. As funções e listas `antes*` são cópia literal do que
// estava em simulators-m6-m9.tsx (valores em reais); todas as posições das réguas de antes são comparadas com a conta
// nova (em centavos). Depois, a tela e os palpites.
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import {
  ApostaIndividualVsIndice,
  compararApostaComIndice,
  palpiteCertoDaAposta,
} from '@/app/(app)/aprender/[licao]/_simuladores/aposta-vs-indice';
import {
  DetectorCharlatanismo,
  formatCompactMoney,
  palpiteCertoDaPromessa,
  projetarPromessa,
} from '@/app/(app)/aprender/[licao]/_simuladores/detector-de-charlatanismo';
import { MODULO_8 } from '@/app/(app)/aprender/[licao]/_simuladores/modulo-8';
import {
  calcularRendaDeFiis,
  palpiteCertoDosFiis,
  RendaPassivaFIIs,
} from '@/app/(app)/aprender/[licao]/_simuladores/renda-passiva-fiis';
import {
  palpiteCertoDoSocio,
  resumirPeriodo,
  SocioVsApostador,
} from '@/app/(app)/aprender/[licao]/_simuladores/socio-vs-apostador';
import {
  palpiteCertoDaVolatilidade,
  simularVolatilidade,
  TesteCardiacoVolatilidade,
} from '@/app/(app)/aprender/[licao]/_simuladores/teste-da-volatilidade';
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
/** O que a régua de antes entregava: "0.65", sem o resto de ponto flutuante da soma. */
const REGUA_DY = regua(60, 110, 5).map((c) => Number((c / 100).toFixed(2)));

// ---------- Os números e as contas de ANTES (cópia literal) ----------

const ANTES_DIAS = [
  { label: 'Seg', varPct: -4.1, valorCents: 95900 },
  { label: 'Ter', varPct: +2.8, valorCents: 98585 },
  { label: 'Qua', varPct: -3.5, valorCents: 95134 },
  { label: 'Qui', varPct: +1.4, valorCents: 96466 },
  { label: 'Sex', varPct: -2.2, valorCents: 94344 },
];

const ANTES_ANOS = [
  { label: 'Ano 1', varPct: +12, valorCents: 112000 },
  { label: 'Ano 2', varPct: +14, valorCents: 127680 },
  { label: 'Ano 3', varPct: +11, valorCents: 141725 },
  { label: 'Ano 4', varPct: +15, valorCents: 162984 },
  { label: 'Ano 5', varPct: +13, valorCents: 184171 },
];

function antesFiis(meta: number, dy: number) {
  const precoCota = 100; // R$ 100
  const dividendoPorCota = precoCota * (dy / 100);
  const cotasNecessarias = Math.ceil(meta / dividendoPorCota);
  const capitalCents = cotasNecessarias * precoCota * 100;
  return { dividendoCents: Math.round(dividendoPorCota * 100), cotasNecessarias, capitalCents };
}

function antesAposta(valor: number) {
  const valorCents = valor * 100;
  const acaoUnicaCents = Math.round(valorCents * 0.6); // -40%
  const etfIndiceCents = Math.round(valorCents * Math.pow(1.1, 5));
  return { acaoUnicaCents, etfIndiceCents };
}

function antesCompacto(reais: number): string {
  if (!Number.isFinite(reais) || reais >= 1e15) return 'R$ ∞ (astronômico)';
  if (reais >= 1e12) return `R$ ${(reais / 1e12).toFixed(2).replace('.', ',')} trilhões`;
  if (reais >= 1e9) return `R$ ${(reais / 1e9).toFixed(2).replace('.', ',')} bilhões`;
  if (reais >= 1e6) return `R$ ${(reais / 1e6).toFixed(2).replace('.', ',')} milhões`;
  return money(Math.round(reais * 100));
}

function antesCharlatao(taxaMes: number, aporte: number) {
  const r = taxaMes / 100;
  const em5Anos = aporte * Math.pow(1 + r, 60);
  const em10Anos = aporte * Math.pow(1 + r, 120);
  const em20Anos = aporte * Math.pow(1 + r, 240);
  return { em5Anos, em10Anos, em20Anos };
}

function antesVolatilidade(valor: number, quedaPct: number) {
  const valorCents = valor * 100;
  const aposQuedaCents = Math.round(valorCents * (1 - quedaPct / 100));
  const rendaFixaCents = Math.round(valorCents * 1.01);
  const altaNecessariaPct = (1 / (1 - quedaPct / 100) - 1) * 100;
  return { aposQuedaCents, rendaFixaCents, altaNecessariaPct };
}

// ---------- (a) A matemática ----------

describe('módulo 8: a matemática não mudou (todas as posições das réguas de antes)', () => {
  it('m8-l1 Sócio vs. apostador: as duas séries', () => {
    expect(resumirPeriodo('dia').itens).toEqual(ANTES_DIAS);
    expect(resumirPeriodo('anos').itens).toEqual(ANTES_ANOS);
    expect(resumirPeriodo('dia')).toMatchObject({ finalCents: 94344, diferencaCents: -5656, altas: 2, quedas: 3 });
    expect(resumirPeriodo('anos')).toMatchObject({ finalCents: 184171, diferencaCents: 84171, altas: 5, quedas: 0 });
  });

  it('m8-l2 FIIs (inclusive a cota a mais que o arredondamento já dava em 0,70%)', () => {
    let casos = 0;
    for (const meta of regua(50, 3000, 50))
      for (const dy of REGUA_DY) {
        casos++;
        const antes = antesFiis(meta, dy);
        expect(calcularRendaDeFiis({ metaCents: meta * 100, dyPct: dy })).toEqual({
          dividendoPorCotaCents: antes.dividendoCents,
          cotas: antes.cotasNecessarias,
          capitalCents: antes.capitalCents,
        });
      }
    expect(casos).toBe(60 * 11);
  });

  it('m8-l3 Aposta vs. índice', () => {
    for (const valor of regua(1000, 20000, 500)) {
      const antes = antesAposta(valor);
      expect(compararApostaComIndice({ valorCents: valor * 100 })).toEqual({
        ...antes,
        diferencaCents: antes.etfIndiceCents - antes.acaoUnicaCents,
      });
    }
  });

  it('m8-l4 Charlatanismo, com o texto compacto igual', () => {
    let casos = 0;
    for (const taxa of regua(2, 15, 0.5))
      for (const aporte of regua(500, 10000, 500)) {
        casos++;
        const antes = antesCharlatao(taxa, aporte);
        const agora = projetarPromessa({ taxaMesPct: taxa, aporteCents: aporte * 100 });
        expect(agora).toEqual({
          em5AnosReais: antes.em5Anos,
          em10AnosReais: antes.em10Anos,
          em20AnosReais: antes.em20Anos,
        });
        for (const v of Object.values(antes)) expect(formatCompactMoney(v)).toBe(antesCompacto(v));
      }
    expect(casos).toBe(27 * 20);
  });

  it('m8-l5 Volatilidade', () => {
    for (const valor of regua(500, 20000, 500))
      for (const queda of regua(10, 60, 5))
        expect(simularVolatilidade({ valorCents: valor * 100, quedaPct: queda })).toEqual(
          antesVolatilidade(valor, queda),
        );
  });
});

// ---------- (b) A tela ----------

describe('m8-l1 · Sócio vs. apostador', () => {
  it('a escolha do período é o controle (sem régua e sem "Ajustar mais")', () => {
    const tela = aberto(SocioVsApostador);
    expect(limites(tela)).toEqual([]);
    expect(tela.todos((no) => no.tag === 'details')).toEqual([]);
    expect(tela.todos((no) => no.props.role === 'radio')).toHaveLength(2);
  });

  it('as duas visões com os números e as frases de antes', () => {
    const tela = aberto(SocioVsApostador);
    expect(grande(tela)).toBe('Na sexta, R$ 1.000,00 viraram R$ 943,44 −R$ 56,56 no período');
    for (const item of ANTES_DIAS)
      expect(tudo(tela)).toContain(
        `${item.label} ${item.varPct >= 0 ? '+' : ''}${item.varPct.toFixed(1).replace('.', ',')}% ${dinheiro(item.valorCents)}`,
      );
    expect(tudo(tela)).toContain('Quem olha todo dia tende a vender na baixa por pânico.');
    tocar(tela, 'Olhar em 5 anos');
    expect(grande(tela)).toBe('No ano 5, R$ 1.000,00 viraram R$ 1.841,71 +R$ 841,71 no período');
    expect(tudo(tela)).toContain('Ano 5 +13,0% R$ 1.841,71');
    expect(tudo(tela)).toContain('Quem pensa como sócio atravessa o ruído.');
  });
});

describe('m8-l2 · Renda passiva em FIIs', () => {
  it('mesmas réguas e a meta como controle principal', () => {
    const tela = aberto(RendaPassivaFIIs);
    expect(limites(tela)).toEqual([
      ['Meta de renda mensal isenta', 10_000, 5_000, 300_000, 5_000],
      ['Dividend Yield mensal estimado (cota R$ 100)', 0.85, 0.6, 1.1, 0.05],
    ]);
    principalForaDoMais(tela, 'Meta de renda mensal isenta');
  });

  it('valores didáticos: 118 cotas e R$ 11.800,00', () => {
    const tela = aberto(RendaPassivaFIIs);
    expect(grande(tela)).toContain('R$ 11.800,00 investidos 118 cotas de R$ 100,00');
    expect(tudo(tela)).toContain('Cotas necessárias 118 R$ 0,85/cota');
    expect(tudo(tela)).toContain('Capital acumulado R$ 11.800,00 para gerar a meta');
    mover(tela, 'Meta de renda mensal isenta', 235_000);
    mover(tela, 'Dividend Yield mensal estimado (cota R$ 100)', 1.05);
    const antes = antesFiis(2350, 1.05);
    expect(grande(tela)).toContain(dinheiro(antes.capitalCents));
    expect(grande(tela)).toContain(`${antes.cotasNecessarias} cotas`);
  });
});

describe('m8-l3 · Aposta vs. índice', () => {
  it('mesma régua, sem "Ajustar mais"', () => {
    const tela = aberto(ApostaIndividualVsIndice);
    expect(limites(tela)).toEqual([['Capital investido', 500_000, 100_000, 2_000_000, 50_000]]);
    expect(tela.todos((no) => no.tag === 'details')).toEqual([]);
  });

  it('valores didáticos e depois de mexer', () => {
    const tela = aberto(ApostaIndividualVsIndice);
    expect(grande(tela)).toContain('Diferença entre os dois caminhos R$ 5.052,55');
    expect(tudo(tela)).toContain('1 Ação (queda de −40%) R$ 3.000,00 Risco concentrado');
    expect(tudo(tela)).toContain('ETF Índice (5 anos) R$ 8.052,55 Média ~10% a.a. (+61%)');
    expect(tudo(tela)).toContain('um índice amplo dilui o risco entre dezenas de companhias.');
    mover(tela, 'Capital investido', 1_700_000);
    const antes = antesAposta(17000);
    expect(grande(tela)).toContain(dinheiro(antes.etfIndiceCents - antes.acaoUnicaCents));
  });
});

describe('m8-l4 · Detector de charlatanismo', () => {
  it('mesmas réguas e a taxa prometida como controle principal', () => {
    const tela = aberto(DetectorCharlatanismo);
    expect(limites(tela)).toEqual([
      ['Rentabilidade mensal prometida', 5, 2, 15, 0.5],
      ['Aporte inicial único', 100_000, 50_000, 1_000_000, 50_000],
    ]);
    principalForaDoMais(tela, 'Rentabilidade mensal prometida');
  });

  it('valores didáticos e o caso astronômico', () => {
    const tela = aberto(DetectorCharlatanismo);
    const antes = antesCharlatao(5, 1000);
    expect(grande(tela)).toContain(`Em 20 anos, a promessa diz que vira ${plain(antesCompacto(antes.em20Anos))}`);
    expect(grande(tela)).toContain('R$ 121,74 milhões');
    expect(tudo(tela)).toContain('Em 5 anos (60 meses) R$ 18.679,19');
    expect(tudo(tela)).toContain(`Em 10 anos (120 meses) ${plain(antesCompacto(antes.em10Anos))}`);
    expect(tudo(tela)).toContain('O PIB inteiro do Brasil é ~R$ 11 trilhões. Se alguém promete 5,0% fixos ao mês');
    mover(tela, 'Rentabilidade mensal prometida', 15);
    mover(tela, 'Aporte inicial único', 1_000_000);
    expect(grande(tela)).toContain('R$ ∞ (astronômico)');
  });
});

describe('m8-l5 · Teste da volatilidade', () => {
  it('mesmas réguas e a queda como controle principal', () => {
    const tela = aberto(TesteCardiacoVolatilidade);
    expect(limites(tela)).toEqual([
      ['Queda em cripto / ativo volátil', 35, 10, 60, 5],
      ['Valor investido', 100_000, 50_000, 2_000_000, 50_000],
    ]);
    principalForaDoMais(tela, 'Queda em cripto');
  });

  it('valores didáticos e depois de mexer', () => {
    const tela = aberto(TesteCardiacoVolatilidade);
    expect(grande(tela)).toContain('+53,8% pra R$ 650,00 voltarem a ser R$ 1.000,00');
    expect(tudo(tela)).toContain('Cripto (−35%) R$ 650,00');
    expect(tudo(tela)).toContain('Renda Fixa (+1%) R$ 1.010,00');
    expect(tudo(tela)).toContain('Depois de cair 35% , seu ativo precisa subir +53,8% só para voltar');
    mover(tela, 'Queda em cripto / ativo volátil', 60);
    mover(tela, 'Valor investido', 800_000);
    expect(grande(tela)).toContain('+150,0%');
    expect(tudo(tela)).toContain(dinheiro(antesVolatilidade(8000, 60).aposQuedaCents));
  });
});

// ---------- (c) Os palpites ----------

describe('módulo 8: palpites', () => {
  it('sócio: perdeu muito, perdeu pouco ou ganhou', () => {
    expect(palpiteCertoDoSocio(89_999)).toBe('perdeu-muito');
    expect(palpiteCertoDoSocio(90_000)).toBe('perdeu-pouco');
    expect(palpiteCertoDoSocio(99_999)).toBe('perdeu-pouco');
    expect(palpiteCertoDoSocio(100_000)).toBe('ganhou');
  });

  it('FIIs: 20 e 80 vezes a renda; na régua inteira passa de 80 vezes', () => {
    expect(palpiteCertoDosFiis(10_000, 200_000)).toBe('pouco');
    expect(palpiteCertoDosFiis(10_000, 200_001)).toBe('medio');
    expect(palpiteCertoDosFiis(10_000, 800_000)).toBe('medio');
    expect(palpiteCertoDosFiis(10_000, 800_001)).toBe('muito');
    for (const meta of regua(5_000, 300_000, 5_000))
      for (const dy of REGUA_DY)
        expect(palpiteCertoDosFiis(meta, calcularRendaDeFiis({ metaCents: meta, dyPct: dy }).capitalCents)).toBe(
          'muito',
        );
  });

  it('aposta: 25% e 80% do capital', () => {
    expect(palpiteCertoDaAposta(100_000, 25_000)).toBe('pequena');
    expect(palpiteCertoDaAposta(100_000, 25_001)).toBe('media');
    expect(palpiteCertoDaAposta(100_000, 80_000)).toBe('media');
    expect(palpiteCertoDaAposta(100_000, 80_001)).toBe('grande');
  });

  it('promessa: 100 e 1.000 vezes o aporte (aporte em centavos, projeção em reais)', () => {
    expect(palpiteCertoDaPromessa(100_000, 100_000)).toBe('pouco');
    expect(palpiteCertoDaPromessa(100_000, 100_000.01)).toBe('medio');
    expect(palpiteCertoDaPromessa(100_000, 1_000_000)).toBe('medio');
    expect(palpiteCertoDaPromessa(100_000, 1_000_000.01)).toBe('muito');
    expect(palpiteCertoDaPromessa(100_000, Infinity)).toBe('muito');
  });

  it('volatilidade: a mesma, até 10 pontos a mais ou bem mais', () => {
    expect(palpiteCertoDaVolatilidade(20, 20)).toBe('mesma');
    expect(palpiteCertoDaVolatilidade(20, 25)).toBe('pouco-mais');
    expect(palpiteCertoDaVolatilidade(20, 30)).toBe('pouco-mais');
    expect(palpiteCertoDaVolatilidade(20, 30.01)).toBe('bem-mais');
    expect(palpiteCertoDaVolatilidade(10, simularVolatilidade({ valorCents: 1, quedaPct: 10 }).altaNecessariaPct)).toBe(
      'pouco-mais',
    );
  });

  it.each([
    ['m8-l1', SocioVsApostador, 1],
    ['m8-l2', RendaPassivaFIIs, 2],
    ['m8-l3', ApostaIndividualVsIndice, 0],
    ['m8-l4', DetectorCharlatanismo, 2],
    ['m8-l5', TesteCardiacoVolatilidade, 0],
  ] as const)('%s: sem opção repetida e a certa nos valores didáticos', (_id, Sim, certa) => {
    const lista = opcoes(Sim);
    expect(lista.length).toBeGreaterThanOrEqual(2);
    expect(new Set(lista).size).toBe(lista.length);
    expect(palpitar(Sim, certa)).toContain('Mandou bem!');
    expect(palpitar(Sim, (certa + 1) % lista.length)).toContain('Boa tentativa!');
  });
});

describe('o mapa do módulo 8', () => {
  it('tem as 5 lições e todas abrem no SimuladorShell, no palpite', () => {
    expect(Object.keys(MODULO_8)).toEqual(['m8-l1', 'm8-l2', 'm8-l3', 'm8-l4', 'm8-l5']);
    for (const [id, Sim] of Object.entries(MODULO_8)) {
      const html = renderToString(<Sim locale="pt-BR" />);
      expect(html, id).toContain('data-simulador-shell');
      expect(html, id).toContain('role="radiogroup"');
      expect(html, id).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

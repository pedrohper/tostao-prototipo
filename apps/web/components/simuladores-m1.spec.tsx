// T6.15 · Módulo 1 no SimuladorShell: a MATEMÁTICA NÃO MUDOU. As funções `antes*` são cópia literal das contas que
// estavam em simulators.tsx antes da migração (valores em reais onde era assim); as posições das réguas antigas são
// comparadas com a conta nova (em centavos). Depois, a tela: os mesmos números, com e sem os dados da pessoa.
import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import {
  AjusteDasFatias,
  calcularFatias,
  mudarDesejos,
  mudarNecessidades,
  palpiteCertoDasFatias,
  reguaDaRenda,
} from '@/app/(app)/aprender/[licao]/_simuladores/ajuste-das-fatias';
import {
  BISTURI_GENERICOS,
  BisturiNoFixo,
  calcularBisturi,
  palpiteCertoDoBisturi,
  palpitesDoBisturi,
} from '@/app/(app)/aprender/[licao]/_simuladores/bisturi-no-fixo';
import {
  alternarDia,
  calcularMarmitas,
  DetectorGatilhos,
  palpiteCertoDasMarmitas,
  palpitesDasMarmitas,
} from '@/app/(app)/aprender/[licao]/_simuladores/detector-gatilhos';
import { MODULO_1 } from '@/app/(app)/aprender/[licao]/_simuladores/modulo-1';
import { palpitesEmVolta, palpiteCertoEmValor } from '@/app/(app)/aprender/[licao]/_simuladores/palpites-lote-a';
import {
  calcularRalo,
  palpiteCertoDoRalo,
  RaloDoCafezinho,
} from '@/app/(app)/aprender/[licao]/_simuladores/ralo-do-cafezinho';
import {
  calcularRemanejamento,
  palpiteCertoDoSusto,
  RemanejamentoEmergencia,
} from '@/app/(app)/aprender/[licao]/_simuladores/remanejamento-emergencia';
import type { LessonUserContext } from '@/lib/lesson-context';
import { montar } from './mini-render.testutil';
import {
  aberto,
  grande,
  limites,
  mover,
  palpitar,
  principalForaDoMais,
  regua,
  reguaDe,
  tocar,
  tudo,
} from './simulador.testutil';

const ctx: LessonUserContext = {
  month: '2026-11',
  isCurrentMonth: true,
  incomeCents: 250_000,
  incomeSource: 'extrato',
  spentCents: 180_000,
  topCategory: { name: 'Mercado', totalCents: 60_000 },
  deliveryCents: 43_300, // ~ R$ 433 -> 433 / (20 x 4,33) = 5 vezes por semana
  needsCents: 100_000,
  wantsCents: 80_000,
  subscriptions: [
    { name: 'Netflix', monthlyCents: 5_590 },
    { name: 'Spotify', monthlyCents: 2_190 },
  ],
  subscriptionsMonthlyCents: 7_780,
  subscriptionsYearlyCents: 93_360,
  balanceCents: 400_000,
};

const comContexto = (Sim: typeof RaloDoCafezinho, userContext: LessonUserContext) =>
  function ComContexto() {
    return <Sim locale="pt-BR" userContext={userContext} />;
  };
const semContexto = (Sim: typeof RaloDoCafezinho) =>
  function SemContexto() {
    return <Sim locale="pt-BR" />;
  };
/** O texto da tela antes do chute. */
const noComeco = (Sim: () => React.ReactNode) => tudo(montar(createElement(Sim as () => ReactElement)));

// ---------- As contas de ANTES (cópia literal) ----------

function antesRalo(valor: number, vezes: number, salario: number) {
  const porSemana = valor * vezes * 100;
  const tres = Math.round(porSemana * 13);
  const ano = Math.round(porSemana * 52);
  return { porSemana, tres, ano, salarios: (ano / salario).toFixed(1).replace('.', ',') };
}

function antesFatias(renda: number, nec: number, des: number) {
  const fut = Math.max(0, 100 - nec - des);
  const rendaCents = renda * 100;
  const necCents = Math.round((rendaCents * nec) / 100);
  const desCents = Math.round((rendaCents * des) / 100);
  const futCents = Math.round((rendaCents * fut) / 100);
  return { fut, necCents, desCents, futCents };
}

function antesBisturi(ITENS: readonly { id: string; mensal: number }[], cortados: Record<string, boolean>) {
  const totalMensal = ITENS.reduce((acc, it) => acc + (cortados[it.id] ? it.mensal : 0), 0);
  const totalAnual = totalMensal * 12;
  return { totalMensal, totalAnual };
}

function antesRemanejamento(delivery: number, role: number, compras: number, uber: number) {
  const ALVO = 20000;
  const totalCortes = (delivery + role + compras + uber) * 100;
  const reequilibrado = totalCortes >= ALVO;
  return {
    totalCortes,
    reequilibrado,
    faltam: ALVO - totalCortes,
    largura: Math.min(100, Math.round((totalCortes / ALVO) * 100)),
  };
}

function antesAlternarDia(gatilhos: string[], trocas: number, d: string) {
  let novasTrocas = trocas;
  const next = gatilhos.includes(d) ? gatilhos.filter((x) => x !== d) : [...gatilhos, d];
  if (trocas > next.length) novasTrocas = Math.max(1, next.length);
  return { gatilhos: next, trocas: novasTrocas };
}

function antesMarmitas(quantosGatilhos: number, trocas: number) {
  const ECONOMIA_REFEICAO = 2500;
  const maxTrocas = Math.max(1, quantosGatilhos);
  const diasTrocados = Math.min(trocas, maxTrocas);
  const porSemana = diasTrocados * ECONOMIA_REFEICAO;
  const porMes = Math.round(porSemana * 4.33);
  const porAno = porSemana * 52;
  return { maxTrocas, diasTrocados, porSemana, porMes, porAno };
}

describe('a matemática não mudou (posições das réguas de antes)', () => {
  it('m1-l1 Ralo: todas, com o salário de exemplo e outros', () => {
    const diferentes: number[][] = [];
    for (const v of regua(10, 30, 1))
      for (const vezes of regua(1, 7, 1))
        for (const salario of [1, 99_999, 130_790, 250_000, 416_000, 3_000_000]) {
          const antes = antesRalo(v, vezes, salario);
          const agora = calcularRalo({ gastinhoCents: v * 100, vezesPorSemana: vezes, salarioCents: salario });
          if (
            agora.porSemanaCents !== antes.porSemana ||
            agora.tresMesesCents !== antes.tres ||
            agora.anoCents !== antes.ano ||
            agora.salarios.toFixed(1).replace('.', ',') !== antes.salarios
          )
            diferentes.push([v, vezes, salario]);
        }
    expect(diferentes).toEqual([]);
  });

  it('m1-l2 Fatias: todas (R$ 1.200 a 6.000) e rendas reais fora da faixa', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const renda of [...regua(1200, 6000, 100), 100, 700, 9000, 20_000, 87_300])
      for (const nec of regua(30, 85, 1))
        for (const des of regua(5, 60, 1)) {
          casos++;
          const antes = antesFatias(renda, nec, des);
          const agora = calcularFatias({ rendaCents: renda * 100, necPct: nec, desPct: des });
          if (
            agora.futPct !== antes.fut ||
            agora.necCents !== antes.necCents ||
            agora.desCents !== antes.desCents ||
            agora.futCents !== antes.futCents
          )
            diferentes.push([renda, nec, des]);
        }
    expect(casos).toBe(54 * 56 * 56);
    expect(diferentes).toEqual([]);
  });

  it('m1-l2 Fatias: uma fatia empurra a outra como antes, e a régua da renda é a de antes', () => {
    for (const nec of regua(30, 85, 1))
      for (const des of regua(5, 60, 1))
        for (const val of [5, 15, 30, 40, 55, 60, 70, 85]) {
          if (val >= 30) {
            expect(mudarNecessidades({ necPct: nec, desPct: des }, val)).toEqual({
              necPct: val,
              desPct: val + des > 100 ? 100 - val : des,
            });
          }
          if (val <= 60) {
            expect(mudarDesejos({ necPct: nec, desPct: des }, val)).toEqual({
              desPct: val,
              necPct: val + nec > 100 ? 100 - val : nec,
            });
          }
        }
    for (const renda of [null, 100, 1100, 1200, 2500, 6000, 6100, 9000]) {
      expect(reguaDaRenda(renda === null ? null : renda * 100)).toEqual({
        min: Math.min(1200, renda ?? 1200) * 100,
        max: Math.max(6000, renda ?? 6000) * 100,
      });
    }
  });

  it('m1-l3 Bisturi: todas as combinações marcadas, na lista genérica e numa lista real', () => {
    const reais = [
      { id: 'sub-0', label: 'A', mensal: 5_590 },
      { id: 'sub-1', label: 'B', mensal: 2_190 },
      { id: 'sub-2', label: 'C', mensal: 1 },
    ];
    for (const itens of [BISTURI_GENERICOS, reais]) {
      for (let mascara = 0; mascara < 2 ** itens.length; mascara++) {
        const marcados = itens.filter((_, i) => mascara & (1 << i)).map((it) => it.id);
        const antes = antesBisturi(itens, Object.fromEntries(marcados.map((id) => [id, true])));
        expect(calcularBisturi(itens, marcados)).toEqual({
          mensalCents: antes.totalMensal,
          anualCents: antes.totalAnual,
        });
      }
    }
    expect(BISTURI_GENERICOS.map((i) => i.mensal)).toEqual([4500, 3990, 8990, 1500, 4000]);
  });

  it('m1-l4 Remanejamento: todas', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const d of regua(0, 120, 10))
      for (const r of regua(0, 120, 10))
        for (const c of regua(0, 100, 10))
          for (const u of regua(0, 80, 10)) {
            casos++;
            const antes = antesRemanejamento(d, r, c, u);
            const agora = calcularRemanejamento({
              deliveryCents: d * 100,
              roleCents: r * 100,
              comprasCents: c * 100,
              uberCents: u * 100,
            });
            if (
              agora.totalCents !== antes.totalCortes ||
              agora.reequilibrado !== antes.reequilibrado ||
              (!antes.reequilibrado && agora.faltaCents !== antes.faltam) ||
              agora.progressoPct !== antes.largura
            )
              diferentes.push([d, r, c, u]);
          }
    expect(casos).toBe(13 * 13 * 11 * 9);
    expect(diferentes).toEqual([]);
  });

  it('m1-l5 Gatilhos: todos os conjuntos de dias, trocas e toques', () => {
    const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    for (let mascara = 0; mascara < 128; mascara++) {
      const dias = DIAS.filter((_, i) => mascara & (1 << i));
      for (const trocas of regua(1, 7, 1)) {
        const antes = antesMarmitas(dias.length, trocas);
        expect(calcularMarmitas({ diasDeGatilho: dias.length, trocas })).toEqual({
          maxTrocas: antes.maxTrocas,
          diasTrocados: antes.diasTrocados,
          porSemanaCents: antes.porSemana,
          porMesCents: antes.porMes,
          porAnoCents: antes.porAno,
        });
        for (const d of DIAS) {
          const velho = antesAlternarDia(dias, trocas, d);
          expect(alternarDia({ dias, trocas }, d)).toEqual({ dias: velho.gatilhos, trocas: velho.trocas });
        }
      }
    }
  });
});

// ---------- Palpites ----------

describe('palpites e fronteiras', () => {
  it('m1-l1: menos de 1 salário, de 1 a 3 (inclusive), mais de 3', () => {
    expect(palpiteCertoDoRalo(99_999, 100_000)).toBe('menos-de-um');
    expect(palpiteCertoDoRalo(100_000, 100_000)).toBe('um-a-tres');
    expect(palpiteCertoDoRalo(300_000, 100_000)).toBe('um-a-tres');
    expect(palpiteCertoDoRalo(300_001, 100_000)).toBe('mais-de-tres');
    expect(palpitar(semContexto(RaloDoCafezinho), 2)).toContain('Mandou bem!');
    expect(palpitar(comContexto(RaloDoCafezinho, ctx), 1)).toContain('Mandou bem!');
  });

  it('m1-l2: nada, menos de 20% ou 20% pra cima', () => {
    expect(palpiteCertoDasFatias(0, 200_000)).toBe('nada');
    expect(palpiteCertoDasFatias(1, 200_000)).toBe('abaixo');
    expect(palpiteCertoDasFatias(39_999, 200_000)).toBe('abaixo');
    expect(palpiteCertoDasFatias(40_000, 200_000)).toBe('meta');
    expect(palpitar(semContexto(AjusteDasFatias), 1)).toContain('Mandou bem!');
    expect(palpitar(comContexto(AjusteDasFatias, ctx), 2)).toContain('Mandou bem!');
  });

  it('palpites em valor: três diferentes, em ordem, e a certa muda de lugar', () => {
    for (let semente = 0; semente < 6; semente++) {
      for (const certo of [4, 5, 12, 54_000, 93_360, 260_000]) {
        const opcoes = palpitesEmVolta(certo, semente);
        const cents = opcoes.map((o) => o.cents);
        expect(new Set(cents).size).toBe(3);
        expect([...cents].sort((a, b) => a - b)).toEqual(cents);
        expect(opcoes[semente % 3]!.cents).toBe(certo);
        expect(palpiteCertoEmValor(opcoes, certo)).toBe(opcoes[semente % 3]!.id);
      }
    }
  });

  it('m1-l3: a certa é o ano do que está na conta, em posições diferentes conforme a lista', () => {
    for (let mensal = 1; mensal <= 30_000; mensal += 37) {
      const opcoes = palpitesDoBisturi(mensal);
      const certo = palpiteCertoDoBisturi(opcoes, mensal * 12);
      expect(opcoes.find((o) => o.id === certo)!.cents).toBe(mensal * 12);
    }
    // Lista genérica (celular marcado): a primeira. Assinaturas da pessoa: a última.
    expect(palpitar(semContexto(BisturiNoFixo), 0)).toContain('Mandou bem!');
    expect(palpitar(semContexto(BisturiNoFixo), 2)).toContain('Na real: Uns R$ 540,00');
    expect(palpitar(comContexto(BisturiNoFixo, ctx), 2)).toContain('Mandou bem!');
    expect(palpitar(comContexto(BisturiNoFixo, ctx), 0)).toContain('Na real: Uns R$ 933,60');
  });

  it('m1-l4: falta, na conta certa, ou sobra', () => {
    expect(palpiteCertoDoSusto(19_999)).toBe('falta');
    expect(palpiteCertoDoSusto(20_000)).toBe('certinho');
    expect(palpiteCertoDoSusto(20_001)).toBe('sobra');
    expect(palpitar(RemanejamentoEmergencia, 1)).toContain('Mandou bem!');
  });

  it('m1-l5: a certa é a economia do ano', () => {
    const opcoes = palpitesDasMarmitas(260_000, 3);
    expect(opcoes.map((o) => o.cents)).toEqual([260_000, 390_000, 520_000]);
    expect(palpiteCertoDasMarmitas(opcoes, 260_000)).toBe('a');
    expect(palpitar(DetectorGatilhos, 0)).toContain('Mandou bem!');
    expect(palpitar(DetectorGatilhos, 1)).toContain('Na real: Uns R$ 2.600,00');
  });
});

// ---------- A tela ----------

describe('m1-l1 · Ralo do cafezinho', () => {
  it('valores didáticos: as réguas de antes (em centavos), os mesmos números e a frequência à vista', () => {
    const tela = aberto(semContexto(RaloDoCafezinho));
    expect(limites(tela)).toEqual([
      ['Vezes por semana', 4, 1, 7, 1],
      ['Cada gastinho', 2_000, 1_000, 3_000, 100],
    ]);
    principalForaDoMais(tela, 'Vezes por semana');
    expect(grande(tela)).toContain('Em 1 ano, isso soma R$ 4.160,00');
    expect(tudo(tela)).toContain('Em 3 meses R$ 1.040,00');
    expect(tudo(tela)).toContain('Isso dá 3,2 salários de R$ 1.307,90 por ano.');
    expect(tudo(tela)).not.toContain('Ajustado ao seu delivery');
  });

  it('com os dados da pessoa: delivery calibra a frequência e a renda entra na conta', () => {
    const Sim = comContexto(RaloDoCafezinho, ctx);
    const comeco = noComeco(Sim);
    expect(comeco).toContain('Ajustado ao seu delivery de novembro (R$ 433,00).');
    expect(comeco).toContain('Vezes por semana 5x');
    expect(comeco).toContain('Sua renda no mês R$ 2.500,00');
    const tela = aberto(Sim);
    expect(reguaDe(tela, 'Vezes por semana').props.value).toBe(5);
    expect(grande(tela)).toContain('R$ 5.200,00');
    expect(tudo(tela)).toContain('Isso dá 2,1 salários de R$ 2.500,00 por ano.');
  });

  it('mexendo, segue a conta de antes', () => {
    const tela = aberto(semContexto(RaloDoCafezinho));
    mover(tela, 'Vezes por semana', 7);
    mover(tela, 'Cada gastinho', 3_000);
    expect(grande(tela)).toContain('R$ 10.920,00');
    expect(tudo(tela)).toContain('Em 3 meses R$ 2.730,00');
  });
});

describe('m1-l2 · Ajuste das fatias', () => {
  it('valores didáticos: 55/30 sobre R$ 2.000, réguas de antes', () => {
    const tela = aberto(semContexto(AjusteDasFatias));
    expect(limites(tela)).toEqual([
      ['Desejos (lazer, estilo)', 30, 5, 60, 1],
      ['Sua renda mensal líquida', 200_000, 120_000, 600_000, 10_000],
      ['Necessidades (básico)', 55, 30, 85, 1],
    ]);
    principalForaDoMais(tela, 'Desejos (lazer, estilo)');
    expect(grande(tela)).toContain('Sobra pro futuro por mês R$ 300,00 Básico 55% · lazer 30% · futuro 15%');
    expect(tudo(tela)).toContain('Básico R$ 1.100,00 Lazer R$ 600,00 Futuro R$ 300,00');
    expect(tudo(tela)).toContain('Equilíbrio saudável:');
    expect(tudo(tela)).toContain('ainda guarda R$ 300,00 todo mês');
  });

  it('os avisos aparecem nos mesmos casos de antes', () => {
    const tela = aberto(semContexto(AjusteDasFatias));
    mover(tela, 'Necessidades (básico)', 70);
    expect(tudo(tela)).toContain('Aperto no essencial:');
    expect(tudo(tela)).toContain('Futuro zerado:');
    expect(reguaDe(tela, 'Desejos (lazer, estilo)').props.value).toBe(30);
    mover(tela, 'Necessidades (básico)', 85);
    expect(reguaDe(tela, 'Desejos (lazer, estilo)').props.value).toBe(15);
    mover(tela, 'Necessidades (básico)', 60);
    mover(tela, 'Desejos (lazer, estilo)', 35);
    expect(tudo(tela)).not.toContain('Aperto no essencial');
    expect(tudo(tela)).not.toContain('Equilíbrio saudável');
    expect(tudo(tela)).toContain('O básico leva R$ 1.200,00, o lazer R$ 700,00 e o futuro fica com R$ 100,00 .');
  });

  it('com os dados da pessoa: renda e percentuais reais; a régua cobre renda fora da faixa', () => {
    const Sim = comContexto(AjusteDasFatias, ctx);
    const comeco = noComeco(Sim);
    expect(comeco).toContain('Começa com a sua renda e os seus gastos de novembro');
    expect(comeco).toContain('R$ 2.500,00');
    const tela = aberto(Sim);
    expect(reguaDe(tela, 'Sua renda mensal líquida').props.value).toBe(250_000);
    expect(reguaDe(tela, 'Necessidades (básico)').props.value).toBe(40);
    expect(reguaDe(tela, 'Desejos (lazer, estilo)').props.value).toBe(32);
    expect(grande(tela)).toContain('R$ 700,00');
    const rica = aberto(comContexto(AjusteDasFatias, { ...ctx, incomeCents: 900_000 }));
    expect(reguaDe(rica, 'Sua renda mensal líquida').props.max).toBe(900_000);
  });
});

describe('m1-l3 · Bisturi no fixo', () => {
  it('lista didática com o celular já marcado, e nada escondido num "Ajustar mais"', () => {
    const tela = aberto(semContexto(BisturiNoFixo));
    expect(tela.todos((no) => no.tag === 'details')).toEqual([]);
    expect(grande(tela)).toBe('Guardado em 1 ano R$ 540,00 R$ 45,00 de alívio todo mês');
    expect(tudo(tela)).toContain('Alívio todo mês R$ 45,00');
    expect(tudo(tela)).toContain('Plano celular pós-pago (renegociar p/ controle) R$ 45,00/mês');
    expect(tudo(tela)).toContain('Poder do fixo:');
    expect(tudo(tela)).not.toContain('achou no seu extrato');
  });

  it('marcar e desmarcar muda o número; sem nada marcado mostra a lista toda', () => {
    const tela = aberto(semContexto(BisturiNoFixo));
    tocar(tela, 'Academia');
    expect(grande(tela)).toContain('R$ 1.618,80 R$ 134,90 de alívio todo mês');
    tocar(tela, 'Academia');
    tocar(tela, 'Plano celular');
    expect(grande(tela)).toBe('Cortando a lista toda, em 1 ano R$ 2.757,60 Você ainda não marcou nada.');
    expect(tudo(tela)).toContain('Alívio todo mês R$ 0,00');
    expect(tudo(tela)).toContain('Toque nas opções abaixo para ver o impacto no ano.');
  });

  it('com as assinaturas da pessoa no lugar da lista genérica', () => {
    const Sim = comContexto(BisturiNoFixo, ctx);
    const comeco = noComeco(Sim);
    expect(comeco).toContain('Estas são as assinaturas que o Tostão achou no seu extrato');
    expect(comeco).toContain('Assinaturas na lista 2 A lista toda custa por mês R$ 77,80');
    const tela = aberto(Sim);
    expect(tudo(tela)).toContain('Netflix R$ 55,90/mês');
    expect(tudo(tela)).toContain('Spotify R$ 21,90/mês');
    expect(tudo(tela)).not.toContain('Plano celular pós-pago');
    expect(grande(tela)).toContain('Cortando a lista toda, em 1 ano R$ 933,60');
    tocar(tela, 'Netflix');
    expect(grande(tela)).toContain('Guardado em 1 ano R$ 670,80');
  });

  it('sem assinaturas cai na lista didática; assinaturas zeradas não geram palpite repetido', () => {
    expect(tudo(aberto(comContexto(BisturiNoFixo, { ...ctx, subscriptions: [] })))).toContain('Plano celular pós-pago');
    const zerada = comContexto(BisturiNoFixo, { ...ctx, subscriptions: [{ name: 'Teste', monthlyCents: 0 }] });
    const html = renderToString(createElement(zerada));
    expect(html).not.toContain('role="radio"');
    expect(html).toContain('Teste');
  });
});

describe('m1-l4 · Remanejamento de emergência', () => {
  it('valores didáticos: fecha os R$ 200 certinho, com as réguas de antes', () => {
    const tela = aberto(RemanejamentoEmergencia);
    expect(limites(tela)).toEqual([
      ['Delivery & lanches', 6_000, 0, 12_000, 1_000],
      ['Rolê do fim de semana', 7_000, 0, 12_000, 1_000],
      ['Roupas & comprinhas', 4_000, 0, 10_000, 1_000],
      ['Uber & caronas pagas', 3_000, 0, 8_000, 1_000],
    ]);
    principalForaDoMais(tela, 'Delivery & lanches');
    expect(grande(tela)).toBe('Susto coberto: você remanejou R$ 200,00 A conta fechou certinho');
    expect(tudo(tela)).toContain('Total remanejado: R$ 200,00 de R$ 200,00');
    expect(tudo(tela)).toContain('Susto inesperado Conserto urgente na oficina / farmácia R$ 200,00');
    expect(tudo(tela)).toContain('Mês reequilibrado!');
  });

  it('faltando e sobrando', () => {
    const tela = aberto(RemanejamentoEmergencia);
    mover(tela, 'Delivery & lanches', 0);
    expect(grande(tela)).toBe('Ainda faltam R$ 60,00 Você remanejou R$ 140,00 de R$ 200,00');
    expect(tudo(tela)).toContain('Ainda faltam R$ 60,00: se não compensar');
    mover(tela, 'Delivery & lanches', 12_000);
    expect(grande(tela)).toContain('R$ 260,00 R$ 60,00 além do susto');
  });
});

describe('m1-l5 · Detector de gatilhos', () => {
  it('valores didáticos: 2 trocas, R$ 216,50 no mês e R$ 2.600,00 no ano', () => {
    const tela = aberto(DetectorGatilhos);
    expect(limites(tela)).toEqual([['Trocar por marmita / comida em casa', 2, 1, 3, 1]]);
    principalForaDoMais(tela, 'Trocar por marmita');
    expect(grande(tela)).toBe('Economia em 1 ano R$ 2.600,00 R$ 216,50 por mês');
    expect(tudo(tela)).toContain('Economia no mês R$ 216,50');
    expect(tudo(tela)).toContain('Trocar apenas 2 refeições por comida congelada');
    expect(tudo(tela)).toContain('Dias de gatilho: Qui, Sex, Sáb');
  });

  it('os dias marcados limitam as trocas, como antes (com zero dias ainda conta 1)', () => {
    const tela = aberto(DetectorGatilhos);
    tocar(tela, 'Sex');
    tocar(tela, 'Sáb');
    expect(reguaDe(tela, 'Trocar por marmita / comida em casa').props.value).toBe(1);
    expect(tudo(tela)).toContain('Trocar apenas 1 refeição por comida');
    tocar(tela, 'Qui');
    expect(tudo(tela)).toContain('Nenhum dia de gatilho marcado');
    expect(grande(tela)).toContain('R$ 1.300,00');
  });
});

describe('Módulo 1 inteiro', () => {
  it('cada lição abre no SimuladorShell, com 2 ou 3 palpites diferentes, sem emoji e sem régua crua', () => {
    expect(Object.keys(MODULO_1).sort()).toEqual(['m1-l1', 'm1-l2', 'm1-l3', 'm1-l4', 'm1-l5']);
    for (const [id, Sim] of Object.entries(MODULO_1)) {
      for (const userContext of [null, ctx]) {
        const html = renderToString(<Sim locale="pt-BR" userContext={userContext} />);
        expect(html, id).toContain('data-simulador-shell');
        const tela = montar(<Sim locale="pt-BR" userContext={userContext} />);
        const palpites = tela.todos((no) => no.props.role === 'radio').map((no) => tela.texto(no));
        expect(palpites.length, id).toBeGreaterThanOrEqual(2);
        expect(palpites.length, id).toBeLessThanOrEqual(3);
        expect(new Set(palpites).size, id).toBe(palpites.length);

        const resultado = aberto(() => <Sim locale="pt-BR" userContext={userContext} />);
        expect(tudo(resultado), id).not.toMatch(/\p{Extended_Pictographic}/u);
        const cruas = resultado.todos((no) => no.props.type === 'range' && no.props.className !== 'tostao-slider');
        expect(cruas, id).toEqual([]);
      }
    }
  });
});

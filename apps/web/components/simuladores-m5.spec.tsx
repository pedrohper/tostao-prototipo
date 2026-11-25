// T6.15 · Módulo 5 no SimuladorShell (m5-l3 e m5-l4 são pilotos): a MATEMÁTICA NÃO MUDOU. As funções `antes*` são
// cópia literal das contas que estavam em simulators-m2-m5.tsx (valores em reais); todas as posições das réguas antigas
// são comparadas com a conta nova (em centavos). Depois, a tela.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import {
  AlocacaoRendaExtra,
  alocarRendaExtra,
  mudarPendencias,
  mudarReserva,
  palpiteCertoDoExtra,
} from '@/app/(app)/aprender/[licao]/_simuladores/alocacao-renda-extra';
import {
  AportesVsAumentoDeRenda,
  compararAportes,
  palpiteCertoDosAportes,
} from '@/app/(app)/aprender/[licao]/_simuladores/aportes-vs-aumento-de-renda';
import {
  CalculadoraRoiEducacional,
  calcularRoiEducacional,
  palpiteCertoDoRoi,
} from '@/app/(app)/aprender/[licao]/_simuladores/calculadora-roi-educacional';
import { MODULO_5 } from '@/app/(app)/aprender/[licao]/_simuladores/modulo-5';
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
  reguaDe,
  tudo,
} from './simulador.testutil';

/** Dinheiro como aparece em `tudo()`. */
const reais = (cents: number) => plain(money(cents));

// ---------- As contas de ANTES (cópia literal) ----------

function antesAportes(aporteInicial: number, aportePosCarreira: number) {
  const TAXA = 0.008;
  const calcularMontante = (aporteMensal: number, mesesAportando: number) => {
    let saldo = 0;
    for (let i = 0; i < mesesAportando; i++) {
      saldo = (saldo + aporteMensal * 100) * (1 + TAXA);
    }
    return Math.round(saldo);
  };
  const cenarioACents = calcularMontante(aporteInicial, 120);
  const cenarioBCents = calcularMontante(aportePosCarreira, 84);
  return { cenarioACents, cenarioBCents };
}

function antesRoi(custo: number, aumento: number) {
  const custoCents = custo * 100;
  const aumentoCents = aumento * 100;
  const paybackMeses = custo / aumento;
  const retorno2AnosCents = aumentoCents * 24 - custoCents;
  const roiPct = ((aumento * 24 - custo) / custo) * 100;
  return { paybackMeses, retorno2AnosCents, roiPct };
}

function antesAlocacao(valorExtra: number, pctPendencias: number, pctReserva: number) {
  const pctLazer = Math.max(0, 100 - pctPendencias - pctReserva);
  const totalCents = valorExtra * 100;
  const pendenciasCents = Math.round((totalCents * pctPendencias) / 100);
  const reservaCents = Math.round((totalCents * pctReserva) / 100);
  const lazerCents = totalCents - pendenciasCents - reservaCents;
  return { pctLazer, pendenciasCents, reservaCents, lazerCents };
}

describe('a matemática não mudou (todas as posições das réguas de antes)', () => {
  it('m5-l1 Aportes vs. renda', () => {
    let casos = 0;
    for (const a of regua(50, 400, 25))
      for (const b of regua(300, 2000, 50)) {
        casos++;
        const antes = antesAportes(a, b);
        expect(compararAportes({ cedoCents: a * 100, carreiraCents: b * 100 })).toEqual({
          totalCedoCents: antes.cenarioACents,
          totalCarreiraCents: antes.cenarioBCents,
          diferencaCents: antes.cenarioBCents - antes.cenarioACents,
        });
      }
    expect(casos).toBe(15 * 35);
  });

  it('m5-l2 ROI educacional', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const custo of regua(200, 10_000, 100))
      for (const aumento of regua(100, 3000, 50)) {
        casos++;
        const antes = antesRoi(custo, aumento);
        const agora = calcularRoiEducacional({ custoCents: custo * 100, aumentoCents: aumento * 100 });
        if (
          agora.paybackMeses !== antes.paybackMeses ||
          agora.retorno2AnosCents !== antes.retorno2AnosCents ||
          agora.roiPct !== antes.roiPct
        )
          diferentes.push([custo, aumento]);
      }
    expect(casos).toBe(99 * 59);
    expect(diferentes).toEqual([]);
  });

  it('m5-l5 Alocação da renda extra', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const v of regua(100, 3000, 50))
      for (const p of regua(0, 100, 5))
        for (const r of regua(0, 100, 5)) {
          casos++;
          const antes = antesAlocacao(v, p, r);
          const agora = alocarRendaExtra({ valorCents: v * 100, pctPendencias: p, pctReserva: r });
          // Com a soma acima de 100% a tela nunca esteve (uma fatia empurra a outra).
          if (p + r <= 100 && JSON.stringify(agora) !== JSON.stringify(antes)) diferentes.push([v, p, r]);
        }
    expect(casos).toBe(59 * 21 * 21);
    expect(diferentes).toEqual([]);
  });

  it('m5-l5: uma fatia empurra a outra como antes', () => {
    for (const p of regua(0, 100, 5))
      for (const r of regua(0, 100, 5))
        for (const v of regua(0, 100, 5)) {
          const fatias = { pctPendencias: p, pctReserva: r };
          expect(mudarPendencias(fatias, v)).toEqual({ pctPendencias: v, pctReserva: v + r > 100 ? 100 - v : r });
          expect(mudarReserva(fatias, v)).toEqual({ pctReserva: v, pctPendencias: v + p > 100 ? 100 - v : p });
        }
  });

  it('m5-l5: valor digitado com centavos quebrados nunca deixa o lazer negativo, e a soma fecha', () => {
    for (let valor = 10_000; valor <= 10_400; valor++)
      for (const p of regua(0, 100, 5))
        for (const r of regua(0, 100 - p, 5)) {
          const a = alocarRendaExtra({ valorCents: valor, pctPendencias: p, pctReserva: r });
          expect(a.lazerCents).toBeGreaterThanOrEqual(0);
          expect(a.pendenciasCents + a.reservaCents + a.lazerCents).toBe(valor);
        }
  });
});

describe('palpites e fronteiras', () => {
  it('m5-l1: cedo na frente, carreira sem dobrar, ou o dobro', () => {
    expect(palpiteCertoDosAportes(100, 99)).toBe('cedo');
    expect(palpiteCertoDosAportes(100, 100)).toBe('carreira');
    expect(palpiteCertoDosAportes(100, 199)).toBe('carreira');
    expect(palpiteCertoDosAportes(100, 200)).toBe('dobro');
    expect(palpitar(AportesVsAumentoDeRenda, 2)).toContain('Mandou bem!');
  });

  it('m5-l2: até 6 meses, até 1 ano, ou depois', () => {
    expect(palpiteCertoDoRoi(6)).toBe('ate-6');
    expect(palpiteCertoDoRoi(6.01)).toBe('ate-12');
    expect(palpiteCertoDoRoi(12)).toBe('ate-12');
    expect(palpiteCertoDoRoi(12.01)).toBe('mais');
    expect(palpitar(CalculadoraRoiEducacional, 0)).toContain('Mandou bem!');
  });

  it('m5-l5: nada, até um quarto, ou mais', () => {
    expect(palpiteCertoDoExtra(0, 60_000)).toBe('nada');
    expect(palpiteCertoDoExtra(1, 60_000)).toBe('ate-um-quarto');
    expect(palpiteCertoDoExtra(15_000, 60_000)).toBe('ate-um-quarto');
    expect(palpiteCertoDoExtra(15_001, 60_000)).toBe('mais');
    expect(palpitar(AlocacaoRendaExtra, 1)).toContain('Mandou bem!');
    expect(palpitar(AlocacaoRendaExtra, 2)).toContain('Na real: Alguma coisa, até R$ 150,00');
  });
});

describe('m5-l1 · Aportes vs. aumento de renda', () => {
  it('valores de antes: a mesma diferença e os dois totais', () => {
    const antes = antesAportes(50, 800);
    const tela = aberto(AportesVsAumentoDeRenda);
    expect(limites(tela)).toEqual([
      ['Cenário B: aporte após 3 anos de carreira (7 anos)', 80_000, 30_000, 200_000, 5_000],
      ['Cenário A: aporte desde o dia 1 (10 anos)', 5_000, 5_000, 40_000, 2_500],
    ]);
    principalForaDoMais(tela, 'Cenário B: aporte');
    const diferenca = reais(antes.cenarioBCents - antes.cenarioACents);
    expect(grande(tela)).toBe(
      `A carreira termina na frente por ${diferenca} Carreira: ${reais(antes.cenarioBCents)} · dia 1: ${reais(antes.cenarioACents)}`,
    );
    const texto = tudo(tela);
    expect(texto).toContain(`Só juros compostos (R$ 50,00/mês) ${reais(antes.cenarioACents)}`);
    expect(texto).toContain(`Carreira + aporte maior (R$ 800,00/mês) ${reais(antes.cenarioBCents)}`);
    expect(texto).toContain(`gera ${diferenca} a mais do que depender`);
  });

  it('quando começar cedo vence, o texto diz "a menos"', () => {
    const tela = aberto(AportesVsAumentoDeRenda);
    mover(tela, 'Cenário A: aporte desde o dia 1 (10 anos)', 40_000);
    mover(tela, 'Cenário B: aporte após 3 anos de carreira (7 anos)', 30_000);
    const antes = antesAportes(400, 300);
    const diferenca = reais(antes.cenarioACents - antes.cenarioBCents);
    expect(grande(tela)).toContain(`Guardar desde o dia 1 vence por ${diferenca}`);
    expect(tudo(tela)).toContain(`gera ${diferenca} a menos`);
  });
});

describe('m5-l2 · ROI educacional', () => {
  it('valores de antes: 3,0 meses, R$ 10.500,00 em 2 anos e ROI de 700%', () => {
    const tela = aberto(CalculadoraRoiEducacional);
    expect(limites(tela)).toEqual([
      ['Custo total do curso / formação', 150_000, 20_000, 1_000_000, 10_000],
      ['Aumento mensal esperado na renda', 50_000, 10_000, 300_000, 5_000],
    ]);
    principalForaDoMais(tela, 'Custo total do curso');
    expect(grande(tela)).toBe('Payback (se paga em) 3,0 meses Com +R$ 500,00 por mês');
    expect(tudo(tela)).toContain('Lucro líquido em 2 anos R$ 10.500,00');
    expect(tudo(tela)).toContain('ROI em 24 meses: 700%.');
    expect(tudo(tela)).toContain('Excelente retorno');
  });

  it('curso que não se paga em 2 anos', () => {
    const tela = aberto(CalculadoraRoiEducacional);
    mover(tela, 'Custo total do curso / formação', 1_000_000);
    mover(tela, 'Aumento mensal esperado na renda', 10_000);
    expect(grande(tela)).toContain('100,0 meses');
    expect(tudo(tela)).toContain(`Lucro líquido em 2 anos ${reais(-760_000)}`);
    expect(tudo(tela)).toContain('Retorno de médio prazo');
  });
});

describe('m5-l5 · Alocação da renda extra', () => {
  it('valores de antes: R$ 600 em 40/40/20', () => {
    const tela = aberto(AlocacaoRendaExtra);
    expect(limites(tela)).toEqual([
      ['Valor do bico / freela', 60_000, 10_000, 300_000, 5_000],
      ['Pendências / Dívidas', 40, 0, 100, 5],
      ['Reserva de emergência', 40, 0, 100, 5],
    ]);
    principalForaDoMais(tela, 'Valor do bico');
    expect(grande(tela)).toBe('Sobra pro lazer R$ 120,00 20% do bico');
    expect(tudo(tela)).toContain('Pendências R$ 240,00 Reserva R$ 240,00 Lazer (20%) R$ 120,00');
    expect(tudo(tela)).toContain('fatia planejada para o lazer (R$ 120,00) sem culpa');
  });

  it('passando de 100%, a outra fatia encolhe e o lazer zera', () => {
    const tela = aberto(AlocacaoRendaExtra);
    mover(tela, 'Pendências / Dívidas', 90);
    expect(reguaDe(tela, 'Reserva de emergência').props.value).toBe(10);
    expect(grande(tela)).toBe('Sobra pro lazer R$ 0,00 0% do bico');
  });
});

describe('Módulo 5 (sem os pilotos)', () => {
  it('cada lição abre no SimuladorShell, com 2 ou 3 palpites diferentes, sem emoji e sem régua crua', () => {
    expect(Object.keys(MODULO_5).sort()).toEqual(['m5-l1', 'm5-l2', 'm5-l5']);
    for (const [id, Sim] of Object.entries(MODULO_5)) {
      const html = renderToString(<Sim locale="pt-BR" />);
      expect(html, id).toContain('data-simulador-shell');
      const tela = montar(<Sim locale="pt-BR" />);
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

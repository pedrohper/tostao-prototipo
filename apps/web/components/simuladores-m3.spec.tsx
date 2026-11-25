// T6.15 · módulo 3 no SimuladorShell: a MATEMÁTICA NÃO MUDOU. As funções `antes*` são cópia literal das contas que
// estavam em simulators-m2-m5.tsx antes da migração (valores em reais); as posições das réguas são comparadas com a
// conta nova (em centavos). Depois, a tela (mesmos números e textos) e o palpite.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import {
  AvalancheVsBolaDeNeve,
  compararMetodos,
  faixasDaEconomia,
  palpiteCertoDaAvalanche,
  simularMetodo,
} from '@/app/(app)/aprender/[licao]/_simuladores/avalanche-vs-bola-de-neve';
import {
  CalculadoraMinimoExistencial,
  PISO_LEGAL_CENTS,
  calcularMinimoExistencial,
  palpiteCertoDoMinimo,
  tetoDoPouco,
} from '@/app/(app)/aprender/[licao]/_simuladores/calculadora-minimo-existencial';
import {
  CalculadoraValorOriginal,
  calcularValorOriginal,
  faixasDoValorOriginal,
  palpiteCertoDoValorOriginal,
} from '@/app/(app)/aprender/[licao]/_simuladores/calculadora-valor-original';
import { MODULO_3 } from '@/app/(app)/aprender/[licao]/_simuladores/modulo-3';
import {
  SimuladorDesenrolaSerasa,
  avaliarAcordo,
  palpiteCertoDoAcordo,
} from '@/app/(app)/aprender/[licao]/_simuladores/simulador-desenrola-serasa';
import {
  TermometroDeSangria,
  calcularSangria,
  faixasDaSangria,
  palpiteCertoDaSangria,
} from '@/app/(app)/aprender/[licao]/_simuladores/termometro-de-sangria';
import { money } from '@/lib/format';
import {
  aberto,
  grande,
  limites,
  mover,
  palpitar,
  plain,
  principalForaDoMais,
  regua,
  reguas,
  tocar,
  tudo,
} from './simulador.testutil';

const reais = (cents: number) => plain(money(cents));

/** Posições da régua pra amostrar: os extremos, os vizinhos deles e uma a cada `salto`. */
const amostra = (min: number, max: number, passo: number, salto: number) => {
  const todas = regua(min, max, passo);
  return todas.filter((_, i) => i % salto === 0 || i === 1 || i >= todas.length - 2);
};

// ---------- As contas de ANTES (cópia literal) ----------

type DividaAntes = { id: string; nome: string; saldo: number; taxa: number; ativa: boolean };

function antesSangria(dividas: DividaAntes[]) {
  const ativasOrdenadas = [...dividas].filter((d) => d.ativa).sort((a, b) => b.taxa - a.taxa);
  const jurosTotalMesCents = ativasOrdenadas.reduce((acc, d) => acc + Math.round(d.saldo * 100 * (d.taxa / 100)), 0);
  const porDivida = dividas.map((d) => ({
    mesesDobra: d.taxa > 0 ? Math.log(2) / Math.log(1 + d.taxa / 100) : Infinity,
    sangriaCents: Math.round(d.saldo * 100 * (d.taxa / 100)),
  }));
  return { jurosTotalMesCents, ordem: ativasOrdenadas.map((d) => d.id), porDivida };
}

function antesAvalanche(estrategia: 'avalanche' | 'bola', extra: number) {
  type DividaBase = { id: string; nome: string; saldo: number; taxa: number; min: number };
  const BASE: DividaBase[] = [
    { id: 'cartao', nome: 'Cartão (14%/m)', saldo: 180000, taxa: 0.14, min: 27000 },
    { id: 'carne', nome: 'Loja/Carnê (6%/m)', saldo: 60000, taxa: 0.06, min: 9000 },
    { id: 'emp', nome: 'Empréstimo (3,5%/m)', saldo: 300000, taxa: 0.035, min: 20000 },
  ];
  const itens = BASE.map((d) => ({ ...d }));
  let totalJuros = 0;
  let meses = 0;
  let primeiraQuitadaMes = 0;
  const extraCents = extra * 100;

  while (itens.some((d) => d.saldo > 0) && meses < 120) {
    meses++;
    // Aplica juros do mês
    for (const d of itens) {
      if (d.saldo > 0) {
        const juro = Math.round(d.saldo * d.taxa);
        d.saldo += juro;
        totalJuros += juro;
      }
    }

    // Paga mínimos
    let sobra = extraCents;
    for (const d of itens) {
      if (d.saldo > 0) {
        const pag = Math.min(d.saldo, d.min);
        d.saldo -= pag;
        if (pag < d.min) sobra += d.min - pag;
      } else {
        sobra += d.min;
      }
    }

    // Direciona aporte extra pela estratégia
    const ativas = itens.filter((d) => d.saldo > 0);
    ativas.sort((a, b) => (estrategia === 'avalanche' ? b.taxa - a.taxa : a.saldo - b.saldo));

    for (const alvo of ativas) {
      if (sobra <= 0) break;
      const pag = Math.min(alvo.saldo, sobra);
      alvo.saldo -= pag;
      sobra -= pag;
    }

    if (primeiraQuitadaMes === 0 && itens.some((d) => d.saldo === 0)) {
      primeiraQuitadaMes = meses;
    }
  }

  return { totalJuros, meses, primeiraQuitadaMes };
}

function antesValorOriginal(valorHoje: number, mesesAtraso: number, taxaEstimada: number) {
  const hojeCents = valorHoje * 100;
  const principalCents = Math.round(hojeCents / Math.pow(1 + taxaEstimada / 100, mesesAtraso));
  const jurosAcumuladosCents = Math.max(0, hojeCents - principalCents);
  const ofertaMinCents = Math.round(principalCents * 0.8);
  const ofertaMaxCents = Math.min(hojeCents, Math.round(principalCents * 1.2));
  return { principalCents, jurosAcumuladosCents, ofertaMinCents, ofertaMaxCents };
}

function antesDesenrola(renda: number, parcela: number) {
  const pct = (parcela / renda) * 100;
  const risco = pct > 20;
  return { pct, risco, maximoCents: Math.round(renda * 20) };
}

function antesMinimo(moradia: number, alimentacao: number, basicos: number, renda: number) {
  const minimoRealCents = (moradia + alimentacao + basicos) * 100;
  const rendaCents = renda * 100;
  const margemRealCents = rendaCents - minimoRealCents;
  return { minimoRealCents, margemRealCents, sobraCents: margemRealCents > 0 ? margemRealCents : 0 };
}

// ---------- (a) A matemática não mudou ----------

const NOMES = [
  { id: 'rotativo', nome: 'Cartão rotativo', taxa: 14 },
  { id: 'cheque', nome: 'Cheque especial', taxa: 8 },
  { id: 'emprestimo', nome: 'Empréstimo pessoal', taxa: 4 },
];

function compararSangria(saldos: number[], marcadas: number) {
  const dividas = NOMES.map((d, i) => ({ ...d, saldo: saldos[i]!, ativa: Boolean(marcadas & (1 << i)) }));
  const antes = antesSangria(dividas);
  const agora = calcularSangria(dividas.map(({ saldo, ...d }) => ({ ...d, saldoCents: saldo * 100 })));
  return (
    agora.totalCents === antes.jurosTotalMesCents &&
    agora.ordemDeAtaque.map((d) => d.id).join() === antes.ordem.join() &&
    agora.porDivida.every(
      (d, i) => d.jurosCents === antes.porDivida[i]!.sangriaCents && d.mesesDobra === antes.porDivida[i]!.mesesDobra,
    )
  );
}

describe('módulo 3: a matemática não mudou', () => {
  it('m3-l1: cada régua inteira, e combinações das três com todas as marcações (amostra com os extremos)', () => {
    const diferentes: unknown[] = [];
    let casos = 0;
    const conferir = (saldos: number[], marcadas: number) => {
      casos++;
      if (!compararSangria(saldos, marcadas)) diferentes.push([saldos, marcadas]);
    };
    for (let marcadas = 0; marcadas < 8; marcadas++) {
      for (const saldo of regua(300, 6000, 100))
        for (let i = 0; i < 3; i++) {
          const saldos = [1500, 1000, 2500];
          saldos[i] = saldo;
          conferir(saldos, marcadas);
        }
      const pontos = amostra(300, 6000, 100, 5);
      for (const a of pontos) for (const b of pontos) for (const c of pontos) conferir([a, b, c], marcadas);
    }
    expect(casos).toBeGreaterThan(20_000);
    expect(diferentes).toEqual([]);
  });

  it('m3-l2: todas as posições do aporte, nos dois métodos', () => {
    for (const extra of regua(50, 800, 50)) {
      expect(simularMetodo('avalanche', extra * 100), `${extra}`).toEqual(antesAvalanche('avalanche', extra));
      expect(simularMetodo('bola', extra * 100), `${extra}`).toEqual(antesAvalanche('bola', extra));
      expect(compararMetodos(extra * 100).economiaCents).toBe(
        antesAvalanche('bola', extra).totalJuros - antesAvalanche('avalanche', extra).totalJuros,
      );
    }
  });

  it('m3-l3: todas as combinações das três réguas', () => {
    const diferentes: number[][] = [];
    let casos = 0;
    for (const v of regua(500, 20000, 250))
      for (const m of regua(1, 60, 1))
        for (const t of regua(2, 15, 0.5)) {
          casos++;
          const antes = antesValorOriginal(v, m, t);
          const agora = calcularValorOriginal({ hojeCents: v * 100, mesesAtraso: m, taxaEstimada: t });
          if (
            agora.principalCents !== antes.principalCents ||
            agora.jurosCents !== antes.jurosAcumuladosCents ||
            agora.ofertaMinCents !== antes.ofertaMinCents ||
            agora.ofertaMaxCents !== antes.ofertaMaxCents
          )
            diferentes.push([v, m, t]);
        }
    expect(casos).toBe(79 * 60 * 27);
    expect(diferentes).toEqual([]);
  });

  it('m3-l4: todas as combinações de renda e parcela', () => {
    const diferentes: number[][] = [];
    let casos = 0;
    for (const r of regua(1200, 8000, 100))
      for (const p of regua(50, 2000, 25)) {
        casos++;
        const antes = antesDesenrola(r, p);
        const agora = avaliarAcordo({ rendaCents: r * 100, parcelaCents: p * 100 });
        if (agora.pct !== antes.pct || agora.risco !== antes.risco || agora.limiteCents !== antes.maximoCents)
          diferentes.push([r, p]);
      }
    expect(casos).toBe(69 * 79);
    expect(diferentes).toEqual([]);
  });

  it('m3-l5: as quatro réguas (amostra com os extremos)', () => {
    const diferentes: number[][] = [];
    let casos = 0;
    for (const m of amostra(0, 2500, 50, 3))
      for (const a of amostra(200, 1500, 50, 2))
        for (const b of amostra(100, 1000, 20, 3))
          for (const r of amostra(1000, 6000, 100, 4)) {
            casos++;
            const antes = antesMinimo(m, a, b, r);
            const agora = calcularMinimoExistencial({
              moradiaCents: m * 100,
              alimentacaoCents: a * 100,
              basicosCents: b * 100,
              rendaCents: r * 100,
            });
            if (
              agora.minimoCents !== antes.minimoRealCents ||
              agora.margemCents !== antes.margemRealCents ||
              agora.sobraCents !== antes.sobraCents
            )
              diferentes.push([m, a, b, r]);
          }
    expect(casos).toBeGreaterThan(50_000);
    expect(diferentes).toEqual([]);
    expect(PISO_LEGAL_CENTS).toBe(60_000);
  });
});

// ---------- (b) A tela e (c) o palpite ----------

describe('m3-l1 · Termômetro de sangria', () => {
  it('mesmas réguas de antes (em centavos) e a lista de dívidas como controle principal', () => {
    const tela = aberto(TermometroDeSangria);
    expect(limites(tela)).toEqual([
      ['Saldo: Cartão rotativo', 150_000, 30_000, 600_000, 10_000],
      ['Saldo: Cheque especial', 100_000, 30_000, 600_000, 10_000],
      ['Saldo: Empréstimo pessoal', 250_000, 30_000, 600_000, 10_000],
    ]);
    principalForaDoMais(tela, 'Dívidas ativas');
  });

  it('valores didáticos: R$ 390,00/mês, a ordem de ataque e o tempo pra dobrar de antes', () => {
    const tela = aberto(TermometroDeSangria);
    expect(grande(tela)).toBe('Sangria mensal total em juros R$ 390,00 por mês, só de juros');
    const t = tudo(tela);
    expect(t).toContain('Ordem de ataque (da mais cara p/ mais barata):');
    expect(t).toContain('1º Cartão rotativo (14%) → 2º Cheque especial (8%) → 3º Empréstimo pessoal (4%).');
    expect(t).toContain('Cartão rotativo R$ 210,00/mês 14%/mês · dobra em 5,3m');
    expect(t).toContain('Cheque especial R$ 80,00/mês 8%/mês · dobra em 9,0m');
    expect(t).toContain('Empréstimo pessoal R$ 100,00/mês 4%/mês · dobra em 17,7m');
  });

  it('tirar dívidas da conta muda o total, some a régua dela e zera sem quebrar', () => {
    const tela = aberto(TermometroDeSangria);
    tocar(tela, 'Cartão rotativo');
    expect(grande(tela)).toContain('R$ 180,00 por mês');
    expect(reguas(tela)).toHaveLength(2);
    expect(tudo(tela)).toContain('Cartão rotativo Fora da conta');
    tocar(tela, 'Cheque especial');
    tocar(tela, 'Empréstimo pessoal');
    expect(grande(tela)).toContain('R$ 0,00 por mês');
    expect(reguas(tela)).toHaveLength(0);
    expect(tudo(tela)).toContain('Nenhuma dívida na conta');
  });

  it('mover um saldo segue a conta de antes', () => {
    const tela = aberto(TermometroDeSangria);
    mover(tela, 'Saldo: Cheque especial', 430_000);
    const antes = antesSangria(NOMES.map((d, i) => ({ ...d, saldo: [1500, 4300, 2500][i]!, ativa: true })));
    expect(grande(tela)).toContain(`${reais(antes.jurosTotalMesCents)} por mês`);
  });

  it('palpite: faixas de 5% e 10% do marcado, sem opções repetidas mesmo com nada marcado', () => {
    const faixas = { baixoCents: 25_000, altoCents: 50_000 };
    expect(palpiteCertoDaSangria(24_999, faixas)).toBe('pouco');
    expect(palpiteCertoDaSangria(25_000, faixas)).toBe('meio');
    expect(palpiteCertoDaSangria(50_000, faixas)).toBe('meio');
    expect(palpiteCertoDaSangria(50_001, faixas)).toBe('muito');
    const nada = faixasDaSangria(NOMES.map((d) => ({ ...d, saldoCents: 30_000, ativa: false })));
    expect(nada).toEqual({ baixoCents: 4_500, altoCents: 9_000 });
    expect(palpitar(TermometroDeSangria, 1)).toContain('Mandou bem!');
    expect(palpitar(TermometroDeSangria, 0)).toContain('Na real: De R$ 250,00 a R$ 500,00');
  });
});

describe('m3-l2 · Avalanche vs. Bola de neve', () => {
  it('mesma régua de antes (em centavos) como controle principal', () => {
    const tela = aberto(AvalancheVsBolaDeNeve);
    expect(limites(tela)).toEqual([['Aporte extra mensal', 25_000, 5_000, 80_000, 5_000]]);
    principalForaDoMais(tela, 'Aporte extra mensal');
  });

  it('valores didáticos: economia, números do método e o comparativo de antes', () => {
    const tela = aberto(AvalancheVsBolaDeNeve);
    const a = antesAvalanche('avalanche', 250);
    const b = antesAvalanche('bola', 250);
    const economia = reais(b.totalJuros - a.totalJuros);
    expect(grande(tela)).toContain(`A Avalanche economiza ${economia}`);
    const t = tudo(tela);
    expect(t).toContain(`1ª dívida quitada ${a.primeiraQuitadaMes} meses`);
    expect(t).toContain(`Total de juros pagos ${reais(a.totalJuros)}`);
    expect(t).toContain(`Comparativo (${a.meses} meses p/ zerar tudo):`);
    expect(t).toContain(`economiza ${economia} em juros`);
    expect(t).toContain(`vitória rápida na 1ª dívida em ${b.primeiraQuitadaMes} meses .`);
  });

  it('trocar de método mostra os números dele; 1 mês sai no singular', () => {
    const tela = aberto(AvalancheVsBolaDeNeve);
    tocar(tela, 'Bola de neve (menor saldo)');
    const b = antesAvalanche('bola', 250);
    expect(tudo(tela)).toContain(`Total de juros pagos ${reais(b.totalJuros)}`);
    expect(tudo(tela)).toContain(`1ª dívida quitada ${b.primeiraQuitadaMes} meses`);
    mover(tela, 'Aporte extra mensal', 80_000);
    expect(tudo(tela)).toContain('1ª dívida quitada 1 mês ');
    expect(tudo(tela)).toContain('vitória rápida na 1ª dívida em 1 mês .');
    expect(tudo(tela)).not.toContain('1 meses');
  });

  it('palpite: metade e o dobro do aporte', () => {
    expect(faixasDaEconomia(25_000)).toEqual({ baixoCents: 12_500, altoCents: 50_000 });
    expect(palpiteCertoDaAvalanche(25_000, 12_499)).toBe('pouco');
    expect(palpiteCertoDaAvalanche(25_000, 12_500)).toBe('meio');
    expect(palpiteCertoDaAvalanche(25_000, 50_000)).toBe('meio');
    expect(palpiteCertoDaAvalanche(25_000, 50_001)).toBe('muito');
    expect(palpitar(AvalancheVsBolaDeNeve, 1)).toContain('Mandou bem!');
    expect(palpitar(AvalancheVsBolaDeNeve, 2)).toContain('Na real: De R$ 125,00 a R$ 500,00');
  });
});

describe('m3-l3 · Calculadora do valor original', () => {
  it('mesmas réguas de antes e o valor cobrado como controle principal', () => {
    const tela = aberto(CalculadoraValorOriginal);
    expect(limites(tela)).toEqual([
      ['Valor cobrado hoje', 450_000, 50_000, 2_000_000, 25_000],
      ['Meses em atraso', 18, 1, 60, 1],
      ['Taxa estimada', 8, 2, 15, 0.5],
    ]);
    principalForaDoMais(tela, 'Valor cobrado hoje');
  });

  it('valores didáticos: principal, juros e a faixa de contraoferta de antes', () => {
    const tela = aberto(CalculadoraValorOriginal);
    const antes = antesValorOriginal(4500, 18, 8);
    expect(grande(tela)).toContain(`Principal original aprox. ${reais(antes.principalCents)}`);
    const t = tudo(tela);
    expect(t).toContain(`Só juros na cobrança ${reais(antes.jurosAcumuladosCents)}`);
    expect(t).toContain(
      `Faixa de contraoferta realista à vista: entre ${reais(antes.ofertaMinCents)} e ${reais(antes.ofertaMaxCents)} .`,
    );
    expect(t).toContain('Nunca aceite a primeira proposta parcelada');
    expect(t).toContain('18m');
    expect(t).toContain('8%/mês');
  });

  it('mexendo nas réguas segue a conta de antes, com a taxa quebrada em vírgula', () => {
    const tela = aberto(CalculadoraValorOriginal);
    mover(tela, 'Meses em atraso', 7);
    mover(tela, 'Taxa estimada', 11.5);
    expect(grande(tela)).toContain(reais(antesValorOriginal(4500, 7, 11.5).principalCents));
    expect(tudo(tela)).toContain('11,5%/mês');
  });

  it('palpite: faixas de 40% e 70% do valor cobrado', () => {
    expect(faixasDoValorOriginal(450_000)).toEqual({ baixoCents: 180_000, altoCents: 315_000 });
    expect(palpiteCertoDoValorOriginal(450_000, 179_999)).toBe('pouco');
    expect(palpiteCertoDoValorOriginal(450_000, 180_000)).toBe('meio');
    expect(palpiteCertoDoValorOriginal(450_000, 315_000)).toBe('meio');
    expect(palpiteCertoDoValorOriginal(450_000, 315_001)).toBe('maior');
    expect(palpitar(CalculadoraValorOriginal, 0)).toContain('Mandou bem!');
    expect(palpitar(CalculadoraValorOriginal, 2)).toContain('Na real: Menos de R$ 1.800,00');
  });
});

describe('m3-l4 · Proposta do Desenrola/Serasa', () => {
  it('mesmas réguas de antes e a parcela como controle principal', () => {
    const tela = aberto(SimuladorDesenrolaSerasa);
    expect(limites(tela)).toEqual([
      ['Parcela da renegociação', 55_000, 5_000, 200_000, 2_500],
      ['Renda líquida mensal', 220_000, 120_000, 800_000, 10_000],
    ]);
    principalForaDoMais(tela, 'Parcela da renegociação');
  });

  it('valores didáticos: 25,0% e zona de risco; baixando a parcela vira saudável', () => {
    const tela = aberto(SimuladorDesenrolaSerasa);
    expect(grande(tela)).toBe('Comprometimento da renda 25,0% limite seguro: 20%');
    expect(tudo(tela)).toContain('Zona de risco de re-inadimplência:');
    expect(tudo(tela)).toContain('(R$ 440,00/mês no máximo)');
    mover(tela, 'Parcela da renegociação', 50_000);
    mover(tela, 'Renda líquida mensal', 250_000);
    expect(grande(tela)).toContain('20,0%');
    expect(tudo(tela)).toContain('Parcela saudável:');
  });

  it('palpite: passar de 20% pesa; 20% certinhos ainda cabe', () => {
    expect(palpiteCertoDoAcordo(avaliarAcordo({ rendaCents: 220_000, parcelaCents: 44_000 }).risco)).toBe('cabe');
    expect(palpiteCertoDoAcordo(avaliarAcordo({ rendaCents: 220_000, parcelaCents: 44_001 }).risco)).toBe('pesa');
    expect(palpitar(SimuladorDesenrolaSerasa, 0)).toContain('Mandou bem!');
    expect(palpitar(SimuladorDesenrolaSerasa, 1)).toContain('Na real: Não: R$ 550,00 por mês pesa demais');
  });
});

describe('m3-l5 · Mínimo existencial', () => {
  it('mesmas réguas de antes e a renda como controle principal', () => {
    const tela = aberto(CalculadoraMinimoExistencial);
    expect(limites(tela)).toEqual([
      ['Sua renda mensal disponível', 200_000, 100_000, 600_000, 10_000],
      ['Aluguel / Moradia', 75_000, 0, 250_000, 5_000],
      ['Alimentação básica', 55_000, 20_000, 150_000, 5_000],
      ['Água, luz e transporte', 32_000, 10_000, 100_000, 2_000],
    ]);
    principalForaDoMais(tela, 'Sua renda mensal disponível');
  });

  it('valores didáticos: sobra R$ 380,00, mínimo R$ 1.620,00 e o texto da lei', () => {
    const tela = aberto(CalculadoraMinimoExistencial);
    expect(grande(tela)).toBe('Sobra p/ negociar R$ 380,00');
    const t = tudo(tela);
    expect(t).toContain('Seu mínimo existencial R$ 1.620,00');
    expect(t).toContain('o decreto federal protege pelo menos R$ 600,00 da renda na Lei do Superendividamento');
    expect(t).toContain('sobrevivência real é R$ 1.620,00 .');
    expect(t).toContain('caibam na sobra real (R$ 380,00).');
  });

  it('quando o básico passa da renda a sobra é zero, não negativa', () => {
    const tela = aberto(CalculadoraMinimoExistencial);
    mover(tela, 'Sua renda mensal disponível', 100_000);
    expect(grande(tela)).toBe('Sobra p/ negociar R$ 0,00');
  });

  it('palpite: nada, até 20% da renda ou mais', () => {
    expect(tetoDoPouco(200_000)).toBe(40_000);
    expect(palpiteCertoDoMinimo(200_000, -1)).toBe('nada');
    expect(palpiteCertoDoMinimo(200_000, 0)).toBe('nada');
    expect(palpiteCertoDoMinimo(200_000, 1)).toBe('pouco');
    expect(palpiteCertoDoMinimo(200_000, 40_000)).toBe('pouco');
    expect(palpiteCertoDoMinimo(200_000, 40_001)).toBe('mais');
    expect(palpitar(CalculadoraMinimoExistencial, 1)).toContain('Mandou bem!');
    expect(palpitar(CalculadoraMinimoExistencial, 0)).toContain('Na real: Alguma coisa, até R$ 400,00');
  });
});

describe('o mapa do módulo 3', () => {
  it('os 5 simuladores abrem no SimuladorShell, no palpite, sem emoji', () => {
    expect(Object.keys(MODULO_3)).toEqual(['m3-l1', 'm3-l2', 'm3-l3', 'm3-l4', 'm3-l5']);
    for (const [id, Sim] of Object.entries(MODULO_3)) {
      const html = renderToString(<Sim locale="pt-BR" />);
      expect(html, id).toContain('data-simulador-shell');
      expect(html, id).toContain('Pular palpite');
      const resultado = tudo(aberto(() => <Sim locale="pt-BR" />));
      expect(`${html} ${resultado}`, id).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

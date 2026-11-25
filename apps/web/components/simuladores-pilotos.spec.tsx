// T6.13 · os 3 pilotos no SimuladorShell: a MATEMÁTICA NÃO MUDOU. As funções `antes*` são cópia literal das contas que
// estavam em simulators-m2-m5.tsx antes da migração (valores em reais); cada posição possível das réguas é comparada
// com a conta nova (em centavos). Depois, a tela: os mesmos números de antes com os mesmos valores.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import {
  BalancoDoEstagio,
  calcularBalancoDoEstagio,
} from '@/app/(app)/aprender/[licao]/_simuladores/balanco-do-estagio';
import {
  BolaDeNeveDoMinimo,
  palpiteCertoDoRotativo,
  projetarMinimo,
} from '@/app/(app)/aprender/[licao]/_simuladores/bola-de-neve-do-minimo';
import {
  CalculadoraHoraDeFreela,
  calcularHoraDeFreela,
  palpiteCertoDoFreela,
} from '@/app/(app)/aprender/[licao]/_simuladores/hora-de-freela';
import { SIMULATORS } from '@/app/(app)/aprender/[licao]/simulators';
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
  reguaDe,
  tudo,
} from './simulador.testutil';

// ---------- As contas de ANTES (cópia literal) ----------

function antesEstagio(bolsa: number, mensalidade: number, transporte: number, alimentacao: number) {
  const liquidoCents = (bolsa - mensalidade - transporte - alimentacao) * 100;
  const positivo = liquidoCents >= 0;
  return { liquidoCents, positivo };
}

function antesFreela(horas: number, valorHora: number, custosDiretos: number, margemRevisao: number) {
  const maoDeObraCents = horas * valorHora * 100;
  const margemCents = Math.round((maoDeObraCents * margemRevisao) / 100);
  const custosCents = custosDiretos * 100;
  const precoMinimoCents = maoDeObraCents + margemCents + custosCents;
  return { maoDeObraCents, margemCents, precoMinimoCents };
}

function antesBola(faturaInicial: number, pctMinimo: number, taxaMensal: number, meses: number) {
  const faturaCents = faturaInicial * 100;
  const tetoLeiCents = faturaCents * 2;
  let saldo = faturaCents;
  let totalPago = 0;
  let bateuTeto = false;

  for (let m = 1; m <= meses; m++) {
    const pagamentoMin = Math.round((saldo * pctMinimo) / 100);
    totalPago += pagamentoMin;
    const restante = Math.max(0, saldo - pagamentoMin);
    const comJuros = Math.round(restante * (1 + taxaMensal / 100));
    if (totalPago + comJuros >= tetoLeiCents) {
      saldo = Math.max(0, tetoLeiCents - totalPago);
      bateuTeto = true;
    } else {
      saldo = comJuros;
    }
  }

  return { saldo, totalPago, totalGeral: totalPago + saldo, bateuTeto };
}

describe('a matemática não mudou (todas as posições das réguas de antes)', () => {
  it('Balanço do estágio', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const b of regua(500, 3000, 50))
      for (const m of regua(0, 1500, 50))
        for (const t of regua(0, 500, 20))
          for (const a of regua(0, 800, 20)) {
            casos++;
            const antes = antesEstagio(b, m, t, a);
            const agora = calcularBalancoDoEstagio({
              bolsaCents: b * 100,
              mensalidadeCents: m * 100,
              transporteCents: t * 100,
              alimentacaoCents: a * 100,
            });
            if (agora.liquidoCents !== antes.liquidoCents || agora.positivo !== antes.positivo)
              diferentes.push([b, m, t, a]);
          }
    expect(casos).toBe(51 * 31 * 26 * 41);
    expect(diferentes).toEqual([]);
  });

  it('Hora de freela', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const h of regua(2, 60, 1))
      for (const v of regua(20, 200, 5))
        for (const c of regua(0, 800, 20))
          for (const mg of regua(0, 40, 5)) {
            casos++;
            const antes = antesFreela(h, v, c, mg);
            const agora = calcularHoraDeFreela({
              horas: h,
              valorHoraCents: v * 100,
              custosCents: c * 100,
              margemPct: mg,
            });
            if (
              agora.maoDeObraCents !== antes.maoDeObraCents ||
              agora.margemCents !== antes.margemCents ||
              agora.precoMinimoCents !== antes.precoMinimoCents
            )
              diferentes.push([h, v, c, mg]);
          }
    expect(casos).toBe(59 * 37 * 41 * 9);
    expect(diferentes).toEqual([]);
  });

  it('Bola de neve do mínimo (meses 1, 3, 6 e 12)', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const f of regua(200, 4000, 50))
      for (const p of regua(15, 40, 5))
        for (const t of regua(10, 18, 0.5))
          for (const meses of [1, 3, 6, 12]) {
            casos++;
            const antes = antesBola(f, p, t, meses);
            const agora = projetarMinimo({ faturaCents: f * 100, pctMinimo: p, taxaMensal: t }, meses);
            if (JSON.stringify(agora) !== JSON.stringify(antes)) diferentes.push([f, p, t, meses]);
          }
    expect(casos).toBe(77 * 6 * 17 * 4);
    expect(diferentes).toEqual([]);
  });
});

// ---------- A tela ----------

describe('piloto m5-l3 · Balanço do estágio', () => {
  it('mesmas réguas de antes (em centavos) e a bolsa como controle principal', () => {
    const tela = aberto(BalancoDoEstagio);
    expect(limites(tela)).toEqual([
      ['Bolsa-auxílio por mês', 120_000, 50_000, 300_000, 5_000],
      ['Mensalidade do curso', 45_000, 0, 150_000, 5_000],
      ['Transporte', 22_000, 0, 50_000, 2_000],
      ['Comida na rua', 28_000, 0, 80_000, 2_000],
    ]);
    principalForaDoMais(tela, 'Bolsa-auxílio');
  });

  it('valores didáticos: sobra R$ 250,00 por mês (R$ 3.000,00 no ano), como antes', () => {
    const tela = aberto(BalancoDoEstagio);
    expect(grande(tela)).toContain('Sobra por mês R$ 250,00 R$ 3.000,00 em um ano');
    expect(tudo(tela)).toContain('sobram R$ 250,00 limpos por mês (R$ 3.000,00/ano)');
    expect(tudo(tela)).toContain('Já descontei R$ 950,00 de curso, transporte e comida');
  });

  it('mexendo nas réguas o número grande segue a conta de antes, inclusive quando falta', () => {
    const tela = aberto(BalancoDoEstagio);
    mover(tela, 'Bolsa-auxílio por mês', 80_000);
    mover(tela, 'Mensalidade do curso', 70_000);
    mover(tela, 'Transporte', 10_000);
    mover(tela, 'Comida na rua', 20_000);
    const antes = antesEstagio(800, 700, 100, 200);
    expect(grande(tela)).toContain(`Falta por mês ${plain(money(Math.abs(antes.liquidoCents)))}`);
    expect(tudo(tela)).toContain('Você está pagando para estagiar');
  });

  it('digitar R$ 1.230 na bolsa atualiza a régua e a sobra', () => {
    const tela = aberto(BalancoDoEstagio);
    const campo = () => tela.todos((no) => no.props.inputMode === 'decimal')[0]!;
    tela.disparar(campo(), 'onFocus', { target: { select: () => undefined } });
    tela.disparar(campo(), 'onChange', { target: { value: 'R$ 1.230' } });
    tela.disparar(campo(), 'onBlur');
    expect(reguaDe(tela, 'Bolsa-auxílio por mês').props.value).toBe(123_000);
    expect(grande(tela)).toContain('R$ 280,00');
  });

  it('palpite: "se paga" é o certo nos valores didáticos', () => {
    expect(palpitar(BalancoDoEstagio, 0)).toContain('Mandou bem!');
    expect(palpitar(BalancoDoEstagio, 1)).toContain('Você achou: Não, falta dinheiro . Na real: Sim, se paga .');
  });
});

describe('piloto m5-l4 · Hora de freela', () => {
  it('mesmas réguas de antes e a hora como controle principal', () => {
    const tela = aberto(CalculadoraHoraDeFreela);
    expect(limites(tela)).toEqual([
      ['Quanto vale a sua hora', 6_000, 2_000, 20_000, 500],
      ['Horas de trabalho', 12, 2, 60, 1],
      ['Custos (net, MEI, apps)', 12_000, 0, 80_000, 2_000],
      ['Folga pra revisões', 20, 0, 40, 5],
    ]);
    principalForaDoMais(tela, 'Quanto vale a sua hora');
  });

  it('valores didáticos: R$ 984,00, com a mesma decomposição de antes', () => {
    const tela = aberto(CalculadoraHoraDeFreela);
    expect(grande(tela)).toContain('Preço mínimo a cobrar R$ 984,00 R$ 264,00 a mais que só as horas');
    expect(tudo(tela)).toContain(
      'R$ 720,00 de horas + R$ 144,00 de margem de alteração + R$ 120,00 de custos diretos.',
    );
  });

  it('mexendo nas réguas o preço segue a conta de antes', () => {
    const tela = aberto(CalculadoraHoraDeFreela);
    mover(tela, 'Quanto vale a sua hora', 8_500);
    mover(tela, 'Horas de trabalho', 31);
    mover(tela, 'Custos (net, MEI, apps)', 34_000);
    mover(tela, 'Folga pra revisões', 35);
    expect(grande(tela)).toContain(plain(money(antesFreela(31, 85, 340, 35).precoMinimoCents)));
  });

  it('palpite: faixas pela distância do "só as horas"', () => {
    expect(palpiteCertoDoFreela(72_000, 72_000)).toBe('so-horas');
    expect(palpiteCertoDoFreela(72_000, 86_400)).toBe('um-pouco');
    expect(palpiteCertoDoFreela(72_000, 86_401)).toBe('bem-mais');
    expect(palpitar(CalculadoraHoraDeFreela, 2)).toContain('Mandou bem!');
    expect(palpitar(CalculadoraHoraDeFreela, 0)).toContain('Na real: Bem mais que R$ 864,00');
  });
});

describe('piloto m2-l2 · Bola de neve do mínimo', () => {
  it('mesmas réguas de antes e a fatura como controle principal', () => {
    const tela = aberto(BolaDeNeveDoMinimo);
    expect(limites(tela)).toEqual([
      ['Fatura no rotativo', 80_000, 20_000, 400_000, 5_000],
      ['Pagamento mínimo', 15, 15, 40, 5],
      ['Rotativo + IOF por mês', 14.5, 10, 18, 0.5],
    ]);
    principalForaDoMais(tela, 'Fatura no rotativo');
  });

  it('valores didáticos: custa R$ 1.600,00 em 1 ano e o mês a mês é o de antes', () => {
    const tela = aberto(BolaDeNeveDoMinimo);
    expect(grande(tela)).toContain(
      'Em 1 ano, essa fatura custa R$ 1.600,00 R$ 1.213,73 já pagos + R$ 386,27 que ainda faltam',
    );
    const t = tudo(tela);
    expect(t).toContain('desembolsado R$ 1.213,73 e ainda deverá R$ 386,27');
    for (const meses of [1, 3, 6, 12]) {
      const antes = antesBola(800, 15, 14.5, meses);
      expect(t).toContain(
        `Mês ${meses} ${meses === 12 ? 'Teto 100% ' : ''}deve ${plain(money(antes.saldo))} já pago: ${plain(money(antes.totalPago))}`,
      );
    }
  });

  it('mexendo nas réguas o total segue a conta de antes', () => {
    const tela = aberto(BolaDeNeveDoMinimo);
    mover(tela, 'Fatura no rotativo', 150_000);
    mover(tela, 'Pagamento mínimo', 30);
    mover(tela, 'Rotativo + IOF por mês', 11.5);
    const antes = antesBola(1500, 30, 11.5, 12);
    expect(grande(tela)).toContain(plain(money(antes.totalGeral)));
    expect(tudo(tela)).toContain(
      `desembolsado ${plain(money(antes.totalPago))} e ainda deverá ${plain(money(antes.saldo))}`,
    );
  });

  it('palpite: faixas de 1,25x e 1,75x; nos valores didáticos é "perto do dobro"', () => {
    expect(palpiteCertoDoRotativo(80_000, 99_999)).toBe('pouco');
    expect(palpiteCertoDoRotativo(80_000, 100_000)).toBe('meio');
    expect(palpiteCertoDoRotativo(80_000, 139_999)).toBe('meio');
    expect(palpiteCertoDoRotativo(80_000, 140_000)).toBe('dobro');
    expect(palpitar(BolaDeNeveDoMinimo, 2)).toContain('Mandou bem!');
    expect(palpitar(BolaDeNeveDoMinimo, 0)).toContain('Na real: Perto de R$ 1.600,00');
  });
});

describe('os pilotos são os simuladores das lições', () => {
  it('m2-l2, m5-l3 e m5-l4 abrem no SimuladorShell, no palpite', () => {
    for (const id of ['m2-l2', 'm5-l3', 'm5-l4']) {
      const Sim = SIMULATORS[id]!;
      const html = renderToString(<Sim locale="pt-BR" />);
      expect(html, id).toContain('data-simulador-shell');
      expect(html, id).toContain('role="radiogroup"');
    }
  });
});

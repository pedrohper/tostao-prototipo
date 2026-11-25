// T6.15 · módulo 4 no SimuladorShell: a MATEMÁTICA NÃO MUDOU. As funções `antes*` são cópia literal das contas e
// decisões que estavam em simulators-m2-m5.tsx antes da migração (valores em reais onde era em reais). Depois, a tela
// (mesmos números e textos), o palpite e o termômetro com os números da pessoa.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import {
  CalculadoraCustoBasico,
  FAIXAS_DO_MURO,
  calcularCustoBasico,
  palpiteCertoDoCustoBasico,
} from '@/app/(app)/aprender/[licao]/_simuladores/calculadora-custo-basico';
import {
  ComparadorLiquidezSeguranca,
  compararLiquidez,
  palpiteCertoDaLiquidez,
} from '@/app/(app)/aprender/[licao]/_simuladores/comparador-liquidez-seguranca';
import { MODULO_4 } from '@/app/(app)/aprender/[licao]/_simuladores/modulo-4';
import {
  ReconstrucaoDoMuro,
  palpiteCertoDaReposicao,
  planejarReposicao,
} from '@/app/(app)/aprender/[licao]/_simuladores/reconstrucao-do-muro';
import {
  SemaforoDaEmergencia,
  classificarEmergencia,
  palpiteCertoDoSemaforo,
} from '@/app/(app)/aprender/[licao]/_simuladores/semaforo-da-emergencia';
import {
  TermometroPazDeEspirito,
  calcularAutonomia,
  entradaDoTermometro,
  palpiteCertoDaPaz,
} from '@/app/(app)/aprender/[licao]/_simuladores/termometro-paz-de-espirito';
import { money } from '@/lib/format';
import { termometroPreset, type LessonUserContext } from '@/lib/lesson-context';
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

const reais = (cents: number) => plain(money(cents));

const ctx: LessonUserContext = {
  month: '2026-11',
  isCurrentMonth: true,
  incomeCents: 250_000,
  incomeSource: 'extrato',
  spentCents: 180_000,
  topCategory: { name: 'Mercado', totalCents: 60_000 },
  deliveryCents: 43_300,
  needsCents: 100_000,
  wantsCents: 80_000,
  subscriptions: [],
  subscriptionsMonthlyCents: 0,
  subscriptionsYearlyCents: 0,
  balanceCents: 400_000,
};

// ---------- As contas de ANTES (cópia literal) ----------

const ANTES_ITENS = [
  { id: 'moradia', label: 'Aluguel / Moradia', valor: 90000, superfluo: false },
  { id: 'mercado', label: 'Mercado básico', valor: 60000, superfluo: false },
  { id: 'transporte', label: 'Transporte', valor: 25000, superfluo: false },
  { id: 'contas', label: 'Luz, água e internet', valor: 25000, superfluo: false },
  { id: 'delivery', label: 'Delivery & lanches', valor: 30000, superfluo: true },
  { id: 'roles', label: 'Rolês & streaming', valor: 25000, superfluo: true },
];

function antesCustoBasico(ativos: Record<string, boolean>) {
  return ANTES_ITENS.reduce((acc, it) => acc + (ativos[it.id] ? it.valor : 0), 0);
}

function antesLiquidez(urgencia: number) {
  const urgenciaCents = urgencia * 100;
  // Investimento travado D+30 força 1 mês no rotativo (~15% com IOF) enquanto rende ~1% travado
  const custoRotativoCents = Math.round(urgenciaCents * 0.15);
  const rendimentoTravadoCents = Math.round(urgenciaCents * 0.01);
  const prejuizoTravadoCents = custoRotativoCents - rendimentoTravadoCents;
  return { custoRotativoCents, rendimentoTravadoCents, prejuizoTravadoCents };
}

function antesSemaforo(inesperado: boolean, urgente: boolean, alternativa: boolean) {
  if (inesperado && urgente && !alternativa) {
    return {
      cor: 'bg-menta-clara text-verde-texto',
      titulo: 'Sinal Verde — Emergência real',
      texto:
        'É inesperado, urgente e não há opção mais barata. É exatamente para isso que sua reserva existe: use sem culpa e planeje a reposição.',
    };
  }
  if (!inesperado && !urgente) {
    return {
      cor: 'bg-rosa text-vermelho-texto',
      titulo: 'Sinal Vermelho — Desejo disfarçado',
      texto:
        'Não é inesperado nem urgente. Não toque na reserva! Se você quer isso, crie uma caixinha separada e junte antes.',
    };
  }
  return {
    cor: 'bg-amarelo-claro text-laranja-texto',
    titulo: 'Sinal Amarelo — Adie 7 dias ou reduza',
    texto: alternativa
      ? 'Existe uma alternativa mais barata: resolva pelo menor custo possível antes de mexer no seu colchão.'
      : 'Espere 7 dias ou reajuste o orçamento do mês antes de sacar da reserva.',
  };
}

function antesMuro(usou: number, porMes: number) {
  const meses = Math.ceil(usou / porMes);
  const pctMes1 = Math.min(100, Math.round((porMes / usou) * 100));
  return { meses, pctMes1 };
}

function antesPaz(guardado: number, custoBasico: number) {
  const mesesAutonomia = guardado / custoBasico;
  const pctBarra = Math.min(100, Math.round((mesesAutonomia / 6) * 100));

  const nivel =
    mesesAutonomia < 1
      ? { cor: 'bg-rosa text-vermelho-texto', label: 'Dependência crítica do próximo salário' }
      : mesesAutonomia < 3
        ? { cor: 'bg-amarelo-claro text-laranja-texto', label: 'Colchão inicial (fôlego de curto prazo)' }
        : mesesAutonomia < 6
          ? { cor: 'bg-azul text-tinta', label: 'Zona de tranquilidade (boa autonomia)' }
          : { cor: 'bg-menta-clara text-verde-texto', label: 'Paz de espírito plena (6+ meses)' };
  return { mesesAutonomia, pctBarra, label: nivel.label };
}

function antesEntradaPaz(userContext: LessonUserContext | null) {
  const preset = termometroPreset(userContext);
  const guardado = preset?.guardado ?? 3600;
  const custoBasico = preset?.custoBasico ?? 1800;
  // A régua cobre os valores reais mesmo fora do intervalo didático.
  const maxGuardado = Math.max(25_000, preset?.guardado ?? 0);
  const minCusto = Math.min(800, preset?.custoBasico ?? 800);
  const maxCusto = Math.max(6000, preset?.custoBasico ?? 6000);
  return { guardado, custoBasico, maxGuardado, minCusto, maxCusto };
}

// ---------- (a) A matemática não mudou ----------

describe('módulo 4: a matemática não mudou', () => {
  it('m4-l1: as 64 marcações possíveis', () => {
    for (let mascara = 0; mascara < 64; mascara++) {
      const marcados = ANTES_ITENS.filter((_, i) => mascara & (1 << i)).map((it) => it.id);
      const antes = antesCustoBasico(Object.fromEntries(marcados.map((id) => [id, true])));
      expect(calcularCustoBasico(marcados), marcados.join()).toEqual({
        mensalCents: antes,
        tresMesesCents: antes * 3,
        seisMesesCents: antes * 6,
      });
    }
  });

  it('m4-l2: todas as posições da urgência', () => {
    for (const u of regua(300, 5000, 100)) expect(compararLiquidez(u * 100), `${u}`).toEqual(antesLiquidez(u));
  });

  it('m4-l3: as 8 combinações de respostas dão o mesmo sinal, título e texto', () => {
    const cores = {
      verde: 'bg-menta-clara text-verde-texto',
      amarelo: 'bg-amarelo-claro text-laranja-texto',
      vermelho: 'bg-rosa text-vermelho-texto',
    };
    for (const inesperado of [true, false])
      for (const urgente of [true, false])
        for (const alternativa of [true, false]) {
          const agora = classificarEmergencia({ inesperado, urgente, alternativa });
          expect({ ...agora, cor: cores[agora.cor] }).toEqual(antesSemaforo(inesperado, urgente, alternativa));
        }
  });

  it('m4-l4: todas as combinações das duas réguas', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const u of regua(200, 6000, 100))
      for (const p of regua(50, 1500, 50)) {
        casos++;
        const antes = antesMuro(u, p);
        const agora = planejarReposicao({ usouCents: u * 100, porMesCents: p * 100 });
        if (agora.meses !== antes.meses || agora.pctMes1 !== antes.pctMes1) diferentes.push([u, p]);
      }
    expect(casos).toBe(59 * 30);
    expect(diferentes).toEqual([]);
  });

  it('m4-l5: todas as combinações das réguas didáticas, e valores reais fora delas', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    const guardados = [...regua(0, 25_000, 200), 40_000, 180_000];
    const custos = [100, 300, 700, ...regua(800, 6000, 100), 9_500, 22_000];
    for (const g of guardados)
      for (const c of custos) {
        casos++;
        const antes = antesPaz(g, c);
        const agora = calcularAutonomia({ guardadoCents: g * 100, custoBasicoCents: c * 100 });
        if (
          agora.mesesAutonomia !== antes.mesesAutonomia ||
          agora.pctBarra !== antes.pctBarra ||
          agora.label !== antes.label
        )
          diferentes.push([g, c]);
      }
    expect(casos).toBe(guardados.length * custos.length);
    expect(diferentes).toEqual([]);
  });
});

// ---------- (b) A tela e (c) o palpite ----------

describe('m4-l1 · Custo básico', () => {
  it('a lista é o controle principal, com os mesmos itens e valores, todos marcados', () => {
    const tela = aberto(CalculadoraCustoBasico);
    expect(limites(tela)).toEqual([]);
    expect(tela.todos((no) => no.tag === 'details')).toEqual([]);
    const itens = tela.todos((no) => no.props.role === 'checkbox');
    expect(itens.map((no) => [plain(tela.texto(no)), no.props['aria-checked']])).toEqual(
      ANTES_ITENS.map((it) => [`${it.label} ${reais(it.valor)}`, true]),
    );
    expect(tudo(tela)).toContain(
      'Desmarque os supérfluos que você cortaria num mês de aperto para achar seu custo básico real',
    );
  });

  it('valores didáticos e cortando os supérfluos: 1, 3 e 6 meses como antes', () => {
    const tela = aberto(CalculadoraCustoBasico);
    expect(grande(tela)).toContain('Muro de 3 meses R$ 7.650,00');
    expect(tudo(tela)).toContain('1 mês R$ 2.550,00 3 meses R$ 7.650,00 6 meses R$ 15.300,00');
    tocar(tela, 'Delivery & lanches');
    tocar(tela, 'Rolês & streaming');
    expect(tudo(tela)).toContain('1 mês R$ 2.000,00 3 meses R$ 6.000,00 6 meses R$ 12.000,00');
  });

  it('palpite: faixas de 2 e 3 meses dos essenciais', () => {
    expect(FAIXAS_DO_MURO).toEqual({ baixoCents: 400_000, altoCents: 600_000 });
    expect(palpiteCertoDoCustoBasico(0)).toBe('pouco');
    expect(palpiteCertoDoCustoBasico(399_999)).toBe('pouco');
    expect(palpiteCertoDoCustoBasico(400_000)).toBe('meio');
    expect(palpiteCertoDoCustoBasico(600_000)).toBe('meio');
    expect(palpiteCertoDoCustoBasico(600_001)).toBe('muito');
    expect(palpitar(CalculadoraCustoBasico, 2)).toContain('Mandou bem!');
    expect(palpitar(CalculadoraCustoBasico, 1)).toContain('Na real: Mais de R$ 6.000,00');
  });
});

describe('m4-l2 · Liquidez e segurança', () => {
  it('mesma régua de antes como controle principal', () => {
    const tela = aberto(ComparadorLiquidezSeguranca);
    expect(limites(tela)).toEqual([['Urgência médica inesperada', 120_000, 30_000, 500_000, 10_000]]);
    expect(tela.todos((no) => no.tag === 'details')).toEqual([]);
  });

  it('valores didáticos: −R$ 168,00, os dois caminhos e o texto de antes', () => {
    const tela = aberto(ComparadorLiquidezSeguranca);
    expect(grande(tela)).toContain('Prejuízo líquido com o dinheiro travado −R$ 168,00');
    const t = tudo(tela);
    expect(t).toContain('Reserva D+0 R$ 0,00 CDB 100% CDI / Selic · de juros pagos');
    expect(t).toContain('Travado D+30 −R$ 168,00 Cai no rotativo 30d · prejuízo líquido');
    expect(t).toContain('Liquidez vale mais que 0,1% de rentabilidade:');
    expect(t).toContain('renda R$ 12,00 no mês, o rotativo cobra R$ 180,00 até o dinheiro destravar');
    expect(t).toContain('Reserva de emergência precisa ser D+0.');
  });

  it('mexendo na urgência segue a conta de antes', () => {
    const tela = aberto(ComparadorLiquidezSeguranca);
    mover(tela, 'Urgência médica inesperada', 470_000);
    expect(grande(tela)).toContain(`−${reais(antesLiquidez(4700).prejuizoTravadoCents)}`);
  });

  it('palpite: nada, até 10% da urgência ou mais', () => {
    expect(palpiteCertoDaLiquidez(120_000, 0)).toBe('nada');
    expect(palpiteCertoDaLiquidez(120_000, 1)).toBe('pouco');
    expect(palpiteCertoDaLiquidez(120_000, 12_000)).toBe('pouco');
    expect(palpiteCertoDaLiquidez(120_000, 12_001)).toBe('muito');
    expect(palpitar(ComparadorLiquidezSeguranca, 0)).toContain('Mandou bem!');
    expect(palpitar(ComparadorLiquidezSeguranca, 2)).toContain('Na real: Mais de R$ 120,00');
  });
});

describe('m4-l3 · Semáforo da emergência', () => {
  const marcadas = (tela: ReturnType<typeof aberto>) =>
    tela
      .todos((no) => no.props.role === 'radio' && no.props['aria-checked'] === true)
      .map((no) => plain(tela.texto(no)));
  /** Responde a pergunta de posição `qual` (0 a 2) com "Sim" ou "Não". */
  const responder = (tela: ReturnType<typeof aberto>, qual: number, resposta: 'Sim' | 'Não') => {
    const botoes = tela.todos((no) => no.props.role === 'radio' && plain(tela.texto(no)) === resposta);
    tela.disparar(botoes[qual]!, 'onClick');
  };

  it('a 1ª pergunta à vista, as outras em "Ajustar mais", com as respostas de antes', () => {
    const tela = aberto(SemaforoDaEmergencia);
    principalForaDoMais(tela, '1. Foi algo inesperado?');
    const t = tudo(tela);
    expect(t).toContain('2. É essencial / urgente hoje?');
    expect(t).toContain('3. Tem alternativa mais barata?');
    expect(marcadas(tela)).toEqual(['Sim', 'Sim', 'Não']);
  });

  it('o veredito por extenso muda com as respostas', () => {
    const tela = aberto(SemaforoDaEmergencia);
    expect(grande(tela)).toBe('Veredito do semáforo Sinal Verde — Emergência real');
    expect(tudo(tela)).toContain(antesSemaforo(true, true, false).texto);
    responder(tela, 2, 'Sim');
    expect(grande(tela)).toContain('Sinal Amarelo — Adie 7 dias ou reduza');
    expect(tudo(tela)).toContain(antesSemaforo(true, true, true).texto);
    responder(tela, 0, 'Não');
    responder(tela, 1, 'Não');
    expect(grande(tela)).toContain('Sinal Vermelho — Desejo disfarçado');
  });

  it('o cenário tem o exemplo concreto e o palpite certo é a cor do sinal', () => {
    expect(renderToString(<SemaforoDaEmergencia />)).toContain('o notebook que você usa pra trabalhar pifou');
    for (const cor of ['verde', 'amarelo', 'vermelho'] as const) expect(palpiteCertoDoSemaforo(cor)).toBe(cor);
    expect(palpitar(SemaforoDaEmergencia, 2)).toContain('Mandou bem!');
    expect(palpitar(SemaforoDaEmergencia, 0)).toContain('Na real: Sinal verde: é emergência real');
  });
});

describe('m4-l4 · Reconstrução do muro', () => {
  it('mesmas réguas de antes e o aporte como controle principal', () => {
    const tela = aberto(ReconstrucaoDoMuro);
    expect(limites(tela)).toEqual([
      ['Aporte mensal p/ recompor', 20_000, 5_000, 150_000, 5_000],
      ['Quanto usou da reserva', 120_000, 20_000, 600_000, 10_000],
    ]);
    principalForaDoMais(tela, 'Aporte mensal p/ recompor');
  });

  it('valores didáticos: 6 meses, 17% no 1º mês e o texto de antes', () => {
    const tela = aberto(ReconstrucaoDoMuro);
    expect(grande(tela)).toBe('Tempo para reconstruir 6 meses');
    const t = tudo(tela);
    expect(t).toContain('Progresso já no 1º mês 17% do muro de pé');
    expect(t).toContain('Usar a reserva não é fracasso:');
    expect(t).toContain('reposição de R$ 200,00/mês como conta fixa até fechar os 6 meses .');
  });

  it('1 mês sai no singular', () => {
    const tela = aberto(ReconstrucaoDoMuro);
    mover(tela, 'Aporte mensal p/ recompor', 150_000);
    expect(grande(tela)).toBe('Tempo para reconstruir 1 mês');
    expect(tudo(tela)).toContain('até fechar esse mês .');
  });

  it('palpite: até 3, de 4 a 6 ou mais de 6 meses', () => {
    expect(palpiteCertoDaReposicao(1)).toBe('ate3');
    expect(palpiteCertoDaReposicao(3)).toBe('ate3');
    expect(palpiteCertoDaReposicao(4)).toBe('ate6');
    expect(palpiteCertoDaReposicao(6)).toBe('ate6');
    expect(palpiteCertoDaReposicao(7)).toBe('mais');
    expect(palpitar(ReconstrucaoDoMuro, 1)).toContain('Mandou bem!');
    expect(palpitar(ReconstrucaoDoMuro, 0)).toContain('Na real: De 4 a 6 meses');
  });
});

describe('m4-l5 · Termômetro da paz de espírito', () => {
  const Didatico = () => <TermometroPazDeEspirito locale="pt-BR" userContext={null} />;
  const com = (userContext: LessonUserContext) =>
    function ComContexto() {
      return <TermometroPazDeEspirito locale="pt-BR" userContext={userContext} />;
    };

  it('mesmas réguas de antes (em centavos) e o saldo como controle principal', () => {
    const tela = aberto(Didatico);
    expect(limites(tela)).toEqual([
      ['Saldo guardado hoje', 360_000, 0, 2_500_000, 20_000],
      ['Seu custo básico mensal', 180_000, 80_000, 600_000, 10_000],
    ]);
    principalForaDoMais(tela, 'Saldo guardado hoje');
    expect(tudo(tela)).not.toContain('já estão aí');
  });

  it('valores didáticos: 2,0 meses de autonomia, colchão inicial', () => {
    const tela = aberto(Didatico);
    expect(grande(tela)).toBe('Autonomia (Runway) 2,0 meses Colchão inicial (fôlego de curto prazo)');
    mover(tela, 'Saldo guardado hoje', 0);
    expect(grande(tela)).toContain('0,0 meses Dependência crítica do próximo salário');
    mover(tela, 'Saldo guardado hoje', 1_080_000);
    expect(grande(tela)).toContain('6,0 meses Paz de espírito plena (6+ meses)');
  });

  it('com o contexto: saldo das contas, custo do mês e o aviso, já na tela do palpite', () => {
    const Sim = com(ctx);
    const html = renderToString(<Sim />);
    expect(html).toContain('Saldo das suas contas e custo do mês já estão aí');
    expect(plain(html)).toContain('R$ 4.000,00');
    expect(plain(html)).toContain('R$ 1.000,00');
    const tela = aberto(Sim);
    expect(limites(tela)).toEqual([
      ['Saldo guardado hoje', 400_000, 0, 2_500_000, 20_000],
      ['Seu custo básico mensal', 100_000, 80_000, 600_000, 10_000],
    ]);
    expect(grande(tela)).toContain('4,0 meses Zona de tranquilidade (boa autonomia)');
  });

  it('valores reais fora do intervalo didático esticam as réguas como antes', () => {
    for (const userContext of [
      null,
      ctx,
      { ...ctx, balanceCents: 9_000_000, needsCents: 1_200_000 },
      { ...ctx, balanceCents: 0, needsCents: 30_000 },
      { ...ctx, balanceCents: 5_000, needsCents: 0, spentCents: 0 },
      { ...ctx, balanceCents: null, needsCents: 0, spentCents: 0 },
    ]) {
      const antes = antesEntradaPaz(userContext);
      expect(entradaDoTermometro(userContext)).toEqual({
        temPreset: termometroPreset(userContext) !== null,
        guardadoCents: antes.guardado * 100,
        custoBasicoCents: antes.custoBasico * 100,
        maxGuardadoCents: antes.maxGuardado * 100,
        minCustoCents: antes.minCusto * 100,
        maxCustoCents: antes.maxCusto * 100,
      });
    }
    const tela = aberto(com({ ...ctx, balanceCents: 9_000_000, needsCents: 30_000 }));
    expect(limites(tela)).toEqual([
      ['Saldo guardado hoje', 9_000_000, 0, 9_000_000, 20_000],
      ['Seu custo básico mensal', 30_000, 30_000, 600_000, 10_000],
    ]);
  });

  it('palpite: menos de 1, até antes de 3, ou 3+ meses; com os números da pessoa muda a resposta', () => {
    expect(palpiteCertoDaPaz(0)).toBe('menos1');
    expect(palpiteCertoDaPaz(0.999)).toBe('menos1');
    expect(palpiteCertoDaPaz(1)).toBe('ate3');
    expect(palpiteCertoDaPaz(2.999)).toBe('ate3');
    expect(palpiteCertoDaPaz(3)).toBe('mais3');
    expect(palpitar(Didatico, 1)).toContain('Mandou bem!');
    expect(palpitar(com(ctx), 2)).toContain('Mandou bem!');
    expect(palpitar(com(ctx), 0)).toContain('Na real: 3 meses ou mais');
  });
});

describe('o mapa do módulo 4', () => {
  it('os 5 simuladores abrem no SimuladorShell, no palpite, sem emoji', () => {
    expect(Object.keys(MODULO_4)).toEqual(['m4-l1', 'm4-l2', 'm4-l3', 'm4-l4', 'm4-l5']);
    for (const [id, Sim] of Object.entries(MODULO_4)) {
      const html = renderToString(<Sim locale="pt-BR" />);
      expect(html, id).toContain('data-simulador-shell');
      expect(html, id).toContain('Pular palpite');
      const resultado = tudo(aberto(() => <Sim locale="pt-BR" />));
      expect(`${html} ${resultado}`, id).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

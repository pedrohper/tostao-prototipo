// T6.15 · módulo 9 no SimuladorShell: contas, casos e gabarito NÃO MUDARAM. Os `antes*` são cópia literal do que
// estava em simulators-m6-m9.tsx antes da migração (valores em reais). Depois, a tela e o palpite.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import {
  ContaAbsurdoEconomico,
  calcularContaDoAbsurdo,
  faixasDoAbsurdo,
  palpiteCertoDoAbsurdo,
} from '@/app/(app)/aprender/[licao]/_simuladores/conta-absurdo-economico';
import { formatCompactMoney } from '@/app/(app)/aprender/[licao]/_simuladores/formato-compacto';
import {
  EscrutinioDaVaga,
  SINAIS_DA_VAGA,
  avaliarVaga,
  palpiteCertoDaVaga,
} from '@/app/(app)/aprender/[licao]/_simuladores/escrutinio-da-vaga';
import { MODULO_9 } from '@/app/(app)/aprender/[licao]/_simuladores/modulo-9';
import {
  QuebraGeometricaPiramide,
  calcularPiramide,
  palpiteCertoDaPiramide,
} from '@/app/(app)/aprender/[licao]/_simuladores/quebra-geometrica-piramide';
import {
  CASOS_DA_FALSA_CENTRAL,
  TesteFalsaCentral,
  corrigirRespostas,
  opcaoCertaDoCaso,
} from '@/app/(app)/aprender/[licao]/_simuladores/teste-falsa-central';
import {
  VantagemDaBanca,
  palpiteCertoDaBanca,
  simularBanca,
} from '@/app/(app)/aprender/[licao]/_simuladores/vantagem-da-banca';
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
  tocar,
  tudo,
} from './simulador.testutil';

const reais = (cents: number) => plain(money(cents));

// ---------- As contas e decisões de ANTES (cópia literal) ----------

const ANTES_CENARIOS = [
  {
    titulo: '1. SMS de compra suspeita',
    texto: '"BANCO: Compra de R$ 2.890 aprovada agora. Não reconhece? Ligue 0800-999-4120."',
    opcoes: [
      { label: 'Número 0800 enviado no SMS', correto: true },
      { label: 'O valor alto da compra', correto: false },
    ],
    explicacao:
      'Golpistas criam um 0800 falso para você ligar para a "falsa central". Sempre abra o app oficial do banco.',
  },
  {
    titulo: '2. Ligação da "segurança"',
    texto: '"Sua conta foi invadida. Para bloquear, faça um Pix para a conta segura do Banco Central."',
    opcoes: [
      { label: 'Pedir Pix para "conta segura"', correto: true },
      { label: 'Falar sobre invasão de conta', correto: false },
    ],
    explicacao: 'Nenhum banco ou Banco Central pede transferência ou Pix para proteger dinheiro. Isso é 100% golpe.',
  },
  {
    titulo: '3. Link de atualização',
    texto: '"Seu app será bloqueado hoje! Atualize seu token em: banco-seguro-atualiza.com"',
    opcoes: [
      { label: 'Domínio estranho + urgência', correto: true },
      { label: 'Mencionar token do app', correto: false },
    ],
    explicacao: 'Links fora do domínio oficial com ameaça de bloqueio imediato são phishing clássico.',
  },
];

function antesAcertos(respostas: Record<number, number>) {
  return ANTES_CENARIOS.filter((c, i) => respostas[i] !== undefined && c.opcoes[respostas[i]]?.correto).length;
}

function antesBanca(bancaInicial: number, aposta: number, s: number) {
  let saldo = bancaInicial;
  let x = s * 9301 + 49297;
  const pontos: number[] = [saldo];
  let jogadas = 0;

  for (let i = 1; i <= 1000; i++) {
    if (saldo < aposta) break;
    jogadas = i;
    x = (x * 16807) % 2147483647;
    const u = x / 2147483647;
    // Probabilidade de ganhar 2x: 47.5% -> RTP = 0.475 * 2 = 95%
    saldo += u < 0.475 ? aposta : -aposta;
    if (i % 200 === 0) pontos.push(saldo);
  }
  if (pontos.length < 6) pontos.push(saldo);
  return { saldoFinal: saldo, jogadas, pontos };
}

function antesPiramide(recrutas: number, niveis: number) {
  const BRASIL = 212_000_000;
  const TERRA = 8_000_000_000;

  const noNivel = Math.pow(recrutas, niveis);
  const totalAcumulado = (Math.pow(recrutas, niveis + 1) - 1) / (recrutas - 1);

  const passouBrasil = totalAcumulado > BRASIL;
  const passouTerra = totalAcumulado > TERRA;
  return { noNivel, totalAcumulado, passouBrasil, passouTerra };
}

const ANTES_SINAIS = [
  'Pede taxa, kit ou curso pago para começar',
  'Usa e-mail gratuito (@gmail) ou só WhatsApp',
  'Promete salário irreal sem entrevista',
  'Pede foto de RG/CPF ou selfie no WhatsApp',
  'Pressão de urgência ("fecha em 30 min")',
];

function antesVaga(marcados: number[]) {
  const score = marcados.length;
  const nivel =
    score === 0
      ? { label: 'Sem sinais de alerta', cor: 'bg-menta-clara text-verde-texto' }
      : score <= 2
        ? { label: 'Risco moderado — investigue', cor: 'bg-amarelo-claro text-laranja-texto' }
        : { label: 'Alto risco de golpe! Fuja', cor: 'bg-rosa text-vermelho-texto' };
  return { score, label: nivel.label };
}

function antesCompacto(reaisValor: number): string {
  if (!Number.isFinite(reaisValor) || reaisValor >= 1e15) return 'R$ ∞ (astronômico)';
  if (reaisValor >= 1e12) return `R$ ${(reaisValor / 1e12).toFixed(2).replace('.', ',')} trilhões`;
  if (reaisValor >= 1e9) return `R$ ${(reaisValor / 1e9).toFixed(2).replace('.', ',')} bilhões`;
  if (reaisValor >= 1e6) return `R$ ${(reaisValor / 1e6).toFixed(2).replace('.', ',')} milhões`;
  return money(Math.round(reaisValor * 100));
}

/** A única mudança de texto: abaixo de 2, "milhão" no singular. */
const noSingular = (texto: string) => texto.replace(/^(R\$ 1,\d\d (?:milh|bilh|trilh))ões$/, '$1ão');

function antesAbsurdo(porVideo: number, minutosDia: number, usuarios: number) {
  const videosDia = minutosDia * 2; // 30s por vídeo
  const ganhoUsuarioDiaCents = videosDia * porVideo * 100;
  const custoDiaReais = (ganhoUsuarioDiaCents / 100) * usuarios;
  const custoMesReais = custoDiaReais * 30;
  return { videosDia, custoDiaReais, custoMesReais };
}

// ---------- (a) A matemática e as decisões não mudaram ----------

describe('módulo 9: as contas e decisões não mudaram', () => {
  it('m9-l1: mesmos casos, textos e opções (com o mesmo gabarito)', () => {
    const semOrdem = (casos: readonly { opcoes: readonly { label: string; correto: boolean }[] }[]) =>
      casos.map((c) => ({ ...c, opcoes: [...c.opcoes].sort((a, b) => a.label.localeCompare(b.label)) }));
    expect(semOrdem(CASOS_DA_FALSA_CENTRAL)).toEqual(semOrdem(ANTES_CENARIOS));
  });

  it('m9-l1: as 27 combinações de resposta contam os mesmos acertos', () => {
    for (let combinacao = 0; combinacao < 27; combinacao++) {
      const agora: Record<number, number> = {};
      const antes: Record<number, number> = {};
      for (let caso = 0; caso < 3; caso++) {
        const escolha = Math.floor(combinacao / 3 ** caso) % 3; // 0 = sem resposta
        if (escolha === 0) continue;
        agora[caso] = escolha - 1;
        const label = CASOS_DA_FALSA_CENTRAL[caso]!.opcoes[escolha - 1]!.label;
        antes[caso] = ANTES_CENARIOS[caso]!.opcoes.findIndex((o) => o.label === label);
      }
      expect(corrigirRespostas(agora), `${combinacao}`).toEqual({
        acertos: antesAcertos(antes),
        respondidos: Object.keys(antes).length,
      });
    }
  });

  it('m9-l2: todas as bancas e apostas, nas 30 primeiras rodadas', () => {
    let casos = 0;
    const diferentes: number[][] = [];
    for (const banca of regua(50, 500, 50))
      for (const aposta of regua(2, 20, 2))
        for (const seed of regua(1, 30, 1)) {
          casos++;
          const antes = antesBanca(banca, aposta, seed);
          const agora = simularBanca({ bancaCents: banca * 100, apostaCents: aposta * 100, seed });
          if (
            agora.saldoFinalCents !== antes.saldoFinal * 100 ||
            agora.jogadas !== antes.jogadas ||
            agora.pontos.join() !== antes.pontos.map((p) => p * 100).join()
          )
            diferentes.push([banca, aposta, seed]);
        }
    expect(casos).toBe(10 * 10 * 30);
    expect(diferentes).toEqual([]);
  });

  it('m9-l3: as 48 combinações', () => {
    for (const recrutas of [2, 3, 5])
      for (const niveis of regua(1, 16, 1))
        expect(calcularPiramide(recrutas, niveis), `${recrutas}/${niveis}`).toEqual(antesPiramide(recrutas, niveis));
  });

  it('m9-l4: os mesmos sinais e as 32 marcações', () => {
    expect(SINAIS_DA_VAGA.map((s) => s.rotulo)).toEqual(ANTES_SINAIS);
    for (let mascara = 0; mascara < 32; mascara++) {
      const indices = [0, 1, 2, 3, 4].filter((i) => mascara & (1 << i));
      const agora = avaliarVaga(indices.map((i) => SINAIS_DA_VAGA[i]!.id));
      expect({ score: agora.score, label: agora.label }, `${mascara}`).toEqual(antesVaga(indices));
    }
  });

  it('m9-l5: todas as combinações, nos números e no texto', () => {
    let casos = 0;
    for (const v of regua(1, 15, 1))
      for (const m of regua(10, 120, 10))
        for (const u of [10_000, 100_000, 1_000_000]) {
          casos++;
          const antes = antesAbsurdo(v, m, u);
          const agora = calcularContaDoAbsurdo({ porVideoCents: v * 100, minutosDia: m, usuarios: u });
          expect(agora).toEqual({
            videosDia: antes.videosDia,
            custoDiaCents: antes.custoDiaReais * 100,
            custoMesCents: antes.custoMesReais * 100,
          });
          expect(formatCompactMoney(agora.custoDiaCents / 100)).toBe(noSingular(antesCompacto(antes.custoDiaReais)));
          expect(formatCompactMoney(agora.custoMesCents / 100)).toBe(noSingular(antesCompacto(antes.custoMesReais)));
        }
    expect(casos).toBe(15 * 12 * 3);
  });

  it('m9-l5: "milhão" no singular só abaixo de 2', () => {
    expect(plain(formatCompactMoney(999_999))).toBe('R$ 999.999,00');
    expect(formatCompactMoney(1_000_000)).toBe('R$ 1,00 milhão');
    expect(formatCompactMoney(1_990_000)).toBe('R$ 1,99 milhão');
    expect(formatCompactMoney(1_999_999)).toBe('R$ 2,00 milhões');
    expect(formatCompactMoney(1_500_000_000)).toBe('R$ 1,50 bilhão');
    expect(formatCompactMoney(2e12)).toBe('R$ 2,00 trilhões');
    expect(formatCompactMoney(Infinity)).toBe('R$ ∞ (astronômico)');
  });
});

// ---------- (b) A tela e (c) o palpite ----------

describe('m9-l1 · Teste da falsa central', () => {
  /** Responde o caso à vista com a opção de texto `label`. */
  const responder = (tela: ReturnType<typeof aberto>, label: string) => tocar(tela, label);

  it('já é um quiz: abre sem palpite, um caso por vez e sem entregar o gabarito', () => {
    const html = renderToString(<TesteFalsaCentral />);
    expect(html).not.toContain('Pular palpite');
    const tela = aberto(TesteFalsaCentral);
    const t = tudo(tela);
    expect(grande(tela)).toBe('Sinais de golpe 0/3 identificados 0 de 3 casos respondidos');
    expect(t).toContain('Clique no sinal de golpe em cada caso');
    expect(t).toContain(ANTES_CENARIOS[0]!.titulo);
    expect(t).toContain(ANTES_CENARIOS[0]!.texto);
    expect(t).not.toContain(ANTES_CENARIOS[1]!.titulo);
    for (const caso of ANTES_CENARIOS) expect(t).not.toContain(caso.explicacao);
    expect(t).not.toContain('Isso!');
    expect(tela.todos((no) => no.props['aria-checked'] === true)).toEqual([]);
  });

  it('a opção certa não fica sempre na mesma posição', () => {
    expect([0, 1, 2].map(opcaoCertaDoCaso)).toEqual([1, 0, 1]);
  });

  it('responde, vai e volta entre os casos e conta os acertos', () => {
    const tela = aberto(TesteFalsaCentral);
    const botao = (texto: string) => tela.um((no) => no.tag === 'button' && plain(tela.texto(no)) === texto);
    expect(botao('Voltar').props.disabled).toBe(true);

    responder(tela, 'Número 0800 enviado no SMS');
    expect(grande(tela)).toContain('1/3 identificados 1 de 3 casos respondidos');
    expect(tudo(tela)).toContain(`Isso! ${ANTES_CENARIOS[0]!.explicacao}`);

    tocar(tela, 'Próximo caso');
    expect(tudo(tela)).toContain(ANTES_CENARIOS[1]!.texto);
    expect(tudo(tela)).not.toContain(ANTES_CENARIOS[1]!.explicacao);
    responder(tela, 'Falar sobre invasão de conta');
    expect(grande(tela)).toContain('1/3 identificados 2 de 3');
    expect(tudo(tela)).toContain(`Não é esse. ${ANTES_CENARIOS[1]!.explicacao}`);

    tocar(tela, 'Próximo caso');
    expect(botao('Próximo caso').props.disabled).toBe(true);
    responder(tela, 'Domínio estranho + urgência');
    expect(grande(tela)).toContain('2/3 identificados 3 de 3');

    // Voltando, a resposta continua marcada e dá pra trocar, como antes.
    tocar(tela, 'Voltar');
    expect(tudo(tela)).toContain('Não é esse.');
    responder(tela, 'Pedir Pix para "conta segura"');
    expect(grande(tela)).toContain('3/3 identificados');
  });
});

describe('m9-l2 · Vantagem da banca', () => {
  it('o botão de simular à vista e as mesmas réguas de antes (em centavos) em "Ajustar mais"', () => {
    const tela = aberto(VantagemDaBanca);
    expect(limites(tela)).toEqual([
      ['Banca inicial', 10_000, 5_000, 50_000, 5_000],
      ['Aposta por jogada (RTP 95%)', 1_000, 200, 2_000, 200],
    ]);
    principalForaDoMais(tela, 'Simular 1.000 jogadas');
  });

  it('valores didáticos e novas rodadas: saldo, jogadas e gráfico de antes', () => {
    const tela = aberto(VantagemDaBanca);
    const barras = () =>
      tela
        .todos((no) => typeof (no.props.style as { height?: string } | undefined)?.height === 'string')
        .map((no) => (no.props.style as { height: string }).height)
        .filter((altura) => altura.endsWith('%'));
    for (const seed of [1, 2, 3]) {
      if (seed > 1) tocar(tela, 'Simular 1.000 jogadas');
      const antes = antesBanca(100, 10, seed);
      expect(grande(tela)).toContain(`Saldo final ${reais(antes.saldoFinal * 100)}`);
      expect(tudo(tela)).toContain(`Jogadas até parar ${antes.jogadas}`);
      expect(barras()).toEqual(
        antes.pontos.map((p) => `${Math.max(6, Math.round((p / Math.max(100, ...antes.pontos, 1)) * 100))}%`),
      );
    }
  });

  it('quando aguenta as 1.000 jogadas a nota muda', () => {
    const tela = aberto(VantagemDaBanca);
    mover(tela, 'Banca inicial', 50_000);
    mover(tela, 'Aposta por jogada (RTP 95%)', 200);
    expect(grande(tela)).toContain(`${reais(antesBanca(500, 2, 1).saldoFinal * 100)} Aguentou as 1.000 jogadas`);
  });

  it('palpite: ganha, sobra ou não dá mais pra apostar', () => {
    expect(palpiteCertoDaBanca(10_000, 1_000, 10_001)).toBe('ganha');
    expect(palpiteCertoDaBanca(10_000, 1_000, 10_000)).toBe('sobra');
    expect(palpiteCertoDaBanca(10_000, 1_000, 1_000)).toBe('sobra');
    expect(palpiteCertoDaBanca(10_000, 1_000, 999)).toBe('zera');
    expect(palpitar(VantagemDaBanca, 2)).toContain('Mandou bem!');
    expect(palpitar(VantagemDaBanca, 0)).toContain('Na real: Nem pra mais uma aposta de R$ 10,00');
  });
});

describe('m9-l3 · Pirâmide', () => {
  it('o nível como controle principal, com a mesma régua e as mesmas opções de recrutas', () => {
    const tela = aberto(QuebraGeometricaPiramide);
    expect(limites(tela)).toEqual([['Nível da pirâmide', 10, 1, 16, 1]]);
    principalForaDoMais(tela, 'Nível da pirâmide');
    const opcoes = tela.todos((no) => no.props.role === 'radio');
    expect(opcoes.map((no) => [plain(tela.texto(no)), no.props['aria-checked']])).toEqual([
      ['2 pessoas', false],
      ['3 pessoas', true],
      ['5 pessoas', false],
    ]);
  });

  it('valores didáticos e o estouro do Brasil e da Terra, como antes', () => {
    const tela = aberto(QuebraGeometricaPiramide);
    expect(grande(tela)).toContain('Total acumulado 88.573 pessoas do topo até o nível 10');
    expect(tudo(tela)).toContain('Só no nível 10 59.049');
    expect(tudo(tela)).toContain('Suba mais alguns níveis');
    tocar(tela, '5 pessoas');
    mover(tela, 'Nível da pirâmide', 12);
    expect(grande(tela)).toContain(antesPiramide(5, 12).totalAcumulado.toLocaleString('pt-BR'));
    expect(tudo(tela)).toContain('Já passou de toda a população do Brasil (212 milhões)');
    mover(tela, 'Nível da pirâmide', 16);
    expect(tudo(tela)).toContain('Estourou a população da Terra (8 bilhões)!');
  });

  it('palpite: 10 e 1.000 vezes a conta em linha reta', () => {
    expect(palpiteCertoDaPiramide(3, 10, 300)).toBe('centenas');
    expect(palpiteCertoDaPiramide(3, 10, 301)).toBe('milhares');
    expect(palpiteCertoDaPiramide(3, 10, 30_000)).toBe('milhares');
    expect(palpiteCertoDaPiramide(3, 10, 30_001)).toBe('muito');
    expect(palpitar(QuebraGeometricaPiramide, 2)).toContain('Mandou bem!');
    expect(palpitar(QuebraGeometricaPiramide, 0)).toContain('Na real: Mais de 30.000');
  });
});

describe('m9-l4 · Escrutínio da vaga', () => {
  it('a lista é o controle principal, com os mesmos 2 sinais já marcados', () => {
    const tela = aberto(EscrutinioDaVaga);
    expect(tela.todos((no) => no.tag === 'details')).toEqual([]);
    const itens = tela.todos((no) => no.props.role === 'checkbox');
    expect(itens.map((no) => [plain(tela.texto(no)), no.props['aria-checked']])).toEqual(
      ANTES_SINAIS.map((sinal, i) => [sinal, i === 0 || i === 3]),
    );
    expect(tudo(tela)).toContain('Marque os sinais presentes na vaga que você recebeu');
  });

  it('o veredito por extenso acompanha as marcações', () => {
    const tela = aberto(EscrutinioDaVaga);
    expect(grande(tela)).toBe('Score: 2/5 sinais Risco moderado — investigue');
    tocar(tela, 'Pressão de urgência');
    expect(grande(tela)).toBe('Score: 3/5 sinais Alto risco de golpe! Fuja');
    for (const sinal of ['Pede taxa', 'Pede foto', 'Pressão de urgência']) tocar(tela, sinal);
    expect(grande(tela)).toBe('Score: 0/5 sinais Sem sinais de alerta');
  });

  it('o cenário mostra a vaga de exemplo e o palpite certo é o nível de risco', () => {
    const html = plain(renderToString(<EscrutinioDaVaga />));
    expect(html).toContain('Outros sinais da lista');
    for (const risco of ['sem', 'moderado', 'alto'] as const) expect(palpiteCertoDaVaga(risco)).toBe(risco);
    expect(palpitar(EscrutinioDaVaga, 1)).toContain('Mandou bem!');
    expect(palpitar(EscrutinioDaVaga, 2)).toContain('Na real: Risco moderado — investigue');
  });
});

describe('m9-l5 · Conta do absurdo', () => {
  it('mesmas réguas de antes e o valor por vídeo como controle principal', () => {
    const tela = aberto(ContaAbsurdoEconomico);
    expect(limites(tela)).toEqual([
      ['Valor prometido por vídeo de 30s', 500, 100, 1_500, 100],
      ['Minutos assistidos por dia', 30, 10, 120, 10],
    ]);
    principalForaDoMais(tela, 'Valor prometido por vídeo de 30s');
  });

  it('valores didáticos: R$ 900 milhões por mês, R$ 30 milhões por dia e o texto de antes', () => {
    const tela = aberto(ContaAbsurdoEconomico);
    expect(grande(tela)).toBe('Custo por mês R$ 900,00 milhões');
    const t = tudo(tela);
    expect(t).toContain('Custo por dia R$ 30,00 milhões');
    expect(t).toContain('30 min por dia (60 vídeos) · usuários: 100 mil');
    expect(t).toContain('São 60 vídeos de 30s por dia');
    expect(t).toContain('Um anunciante real paga ~R$ 0,03 por visualização. Pagar R$ 5,00 por vídeo');
    expect(t).toContain('queimasse R$ 900,00 milhões todo mês — a conta não fecha!');
  });

  it('trocar a plataforma e os minutos segue a conta de antes', () => {
    const tela = aberto(ContaAbsurdoEconomico);
    tocar(tela, '1 milhão');
    mover(tela, 'Minutos assistidos por dia', 120);
    expect(grande(tela)).toContain(antesCompacto(antesAbsurdo(5, 120, 1_000_000).custoMesReais));
  });

  it('palpite: R$ 1.000 e R$ 5.000 por usuário no mês', () => {
    expect(faixasDoAbsurdo(100_000)).toEqual({ baixoCents: 10_000_000_000, altoCents: 50_000_000_000 });
    expect(palpiteCertoDoAbsurdo(100_000, 10_000_000_000)).toBe('menor');
    expect(palpiteCertoDoAbsurdo(100_000, 10_000_000_001)).toBe('meio');
    expect(palpiteCertoDoAbsurdo(100_000, 50_000_000_000)).toBe('meio');
    expect(palpiteCertoDoAbsurdo(100_000, 50_000_000_001)).toBe('maior');
    expect(palpitar(ContaAbsurdoEconomico, 2)).toContain('Mandou bem!');
    expect(palpitar(ContaAbsurdoEconomico, 0)).toContain('Na real: Mais de R$ 500,00 milhões');
  });
});

describe('o mapa do módulo 9', () => {
  it('os 5 abrem no SimuladorShell (o quiz direto, os outros no palpite), sem emoji', () => {
    expect(Object.keys(MODULO_9)).toEqual(['m9-l1', 'm9-l2', 'm9-l3', 'm9-l4', 'm9-l5']);
    for (const [id, Sim] of Object.entries(MODULO_9)) {
      const html = renderToString(<Sim locale="pt-BR" />);
      expect(html, id).toContain('data-simulador-shell');
      expect(html.includes('Pular palpite'), id).toBe(id !== 'm9-l1');
      const resultado = tudo(aberto(() => <Sim locale="pt-BR" />));
      expect(`${html} ${resultado}`.replace(/∞/g, ''), id).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

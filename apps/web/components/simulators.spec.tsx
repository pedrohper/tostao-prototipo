// T4.5 e T6.15 · todos os simuladores das lições: um layout só, renderizam sem quebrar, sem emoji nativo, e os 4 com
// contexto avisam de onde vieram os números (os valores de cada um são conferidos nas specs por módulo).
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import { SIMULATORS } from '@/app/(app)/aprender/[licao]/simulators';
import { SimulatorView } from './simulator-view';
import { aberto, plain as limpo, tudo } from './simulador.testutil';
import { modules } from '@/lib/lessons';
import type { LessonUserContext } from '@/lib/lesson-context';

const plain = (s: string) => limpo(s.replace(/<[^>]+>/g, ' '));
const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

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

describe('os 45 simuladores', () => {
  it('toda lição tem simulador e todos renderizam sem erro', () => {
    expect(Object.keys(SIMULATORS).sort()).toEqual([...lessonIds].sort());
    for (const id of lessonIds) {
      const Sim = SIMULATORS[id]!;
      expect(() => renderToString(<Sim locale="pt-BR" />), id).not.toThrow();
    }
  });

  it('o SimuladorShell é o único layout, com e sem os números da pessoa', () => {
    for (const id of lessonIds) {
      for (const userContext of [null, ctx]) {
        const html = renderToString(<SimulatorView id={id} locale="pt-BR" userContext={userContext} />);
        expect(html.match(/data-simulador-shell/g), id).toHaveLength(1);
      }
    }
  });

  it('abertos no resultado: sem emoji nativo, régua só a do design system e nada de NaN na tela', () => {
    let reguas = 0;
    for (const id of lessonIds) {
      for (const userContext of [null, ctx]) {
        const Sim = SIMULATORS[id]!;
        const tela = aberto(() => <Sim locale="pt-BR" userContext={userContext} />);
        const texto = tudo(tela);
        expect(texto, id).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(texto, id).not.toMatch(/NaN|Infinity|undefined|\[object/);
        // todo slider é o do design system (nenhum <input type="range"> cru sobrando)
        const ranges = tela.todos((no) => no.tag === 'input' && no.props.type === 'range');
        expect(
          ranges.every((no) => no.props.className === 'tostao-slider' && no.props['aria-label']),
          id,
        ).toBe(true);
        reguas += ranges.length;
      }
    }
    expect(reguas).toBeGreaterThan(100); // os sliders de verdade (as listas e escolhas não usam régua)
  });

  it('quem tem palpite abre perguntando, com 2 ou 3 opções diferentes', () => {
    let comPalpite = 0;
    for (const id of lessonIds) {
      for (const userContext of [null, ctx]) {
        const html = renderToString(<SimulatorView id={id} locale="pt-BR" userContext={userContext} />);
        if (!html.includes('Pular palpite')) continue;
        comPalpite++;
        const opcoes = [...html.matchAll(/<button[^>]*role="radio"[^>]*>(.*?)<\/button>/g)].map((m) => plain(m[1]!));
        expect(opcoes.length, id).toBeGreaterThanOrEqual(2);
        expect(opcoes.length, id).toBeLessThanOrEqual(3);
        expect(new Set(opcoes).size, `${id}: ${opcoes.join(' / ')}`).toBe(opcoes.length);
      }
    }
    expect(comPalpite).toBe(44 * 2); // só o quiz da falsa central (m9-l1) abre direto
  });
});

describe('simuladores com os números da pessoa', () => {
  const render = (id: string, userContext: LessonUserContext | null) =>
    plain(renderToString(<SimulatorView id={id} locale="pt-BR" userContext={userContext} />));

  it('M1-L1, M1-L2, M1-L3 e M4-L5 avisam de onde vieram os números', () => {
    expect(render('m1-l1', ctx)).toContain('Ajustado ao seu delivery de novembro');
    expect(render('m1-l2', ctx)).toContain('Começa com a sua renda e os seus gastos de novembro');
    expect(render('m1-l3', ctx)).toContain('Estas são as assinaturas que o Tostão achou no seu extrato');
    expect(render('m4-l5', ctx)).toContain('Saldo das suas contas e custo do mês já estão aí');
    for (const id of ['m1-l1', 'm1-l2', 'm1-l3', 'm4-l5']) {
      expect(render(id, null), id).not.toMatch(/seu delivery|seu extrato|sua renda e os seus|suas contas e custo/);
    }
  });

  it('lições sem personalização ignoram o contexto (o mesmo markup com e sem)', () => {
    for (const id of ['m2-l1', 'm6-l1', 'm9-l2']) {
      expect(renderToString(<SimulatorView id={id} locale="pt-BR" userContext={ctx} />), id).toBe(
        renderToString(<SimulatorView id={id} locale="pt-BR" userContext={null} />),
      );
    }
  });
});

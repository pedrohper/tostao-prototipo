// T4.5 · todos os simuladores das lições: renderizam sem quebrar, sem emoji nativo, e os 4 com contexto mostram
// os números reais da pessoa (e, sem contexto, os valores didáticos de sempre). renderToString = markup inicial.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { SIMULATORS } from '@/app/(app)/aprender/[licao]/simulators';
import { SimulatorView } from './simulator-view';
import { modules } from '@/lib/lessons';
import type { LessonUserContext } from '@/lib/lesson-context';

const plain = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
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

  it('nenhum usa emoji nativo (selos do Tostão no lugar) nem <input type="range"> cru', () => {
    let sliders = 0;
    for (const id of lessonIds) {
      const html = renderToString(<SimulatorView id={id} locale="pt-BR" userContext={null} />);
      expect(html, id).not.toMatch(/\p{Extended_Pictographic}/u);
      // todo slider é o do design system (nenhum <input type="range"> cru sobrando)
      const ranges = html.match(/<input[^>]*type="range"[^>]*>/g) ?? [];
      expect(
        ranges.every((tag) => tag.includes('class="tostao-slider"')),
        id,
      ).toBe(true);
      sliders += html.match(/class="tostao-slider"/g)?.length ?? 0;
    }
    expect(sliders).toBeGreaterThan(40); // os sliders de verdade (o resto aparece só em outros estados)
  });
});

describe('simuladores com os números da pessoa', () => {
  const render = (id: string, userContext: LessonUserContext | null) =>
    plain(renderToString(<SimulatorView id={id} locale="pt-BR" userContext={userContext} />));

  it('M1-L1 Ralo: delivery real calibra a frequência e o salário real entra na conta', () => {
    const html = renderToString(<SimulatorView id="m1-l1" locale="pt-BR" userContext={ctx} />);
    expect(html).toContain('value="5"'); // vezes por semana
    const t = plain(html);
    expect(t).toContain('Ajustado ao seu delivery de novembro');
    expect(t).toContain('salários de R$ 2.500,00 por ano');
  });

  it('M1-L1 Ralo sem contexto: os valores didáticos de sempre (R$ 20, 4x e salário de R$ 1.307,90)', () => {
    const html = renderToString(<SimulatorView id="m1-l1" locale="pt-BR" userContext={null} />);
    expect(html).toContain('value="20"');
    expect(html).toContain('value="4"');
    const t = plain(html);
    expect(t).toContain('salários de R$ 1.307,90 por ano');
    expect(t).not.toContain('Ajustado ao seu delivery');
  });

  it('M1-L2 Fatias: renda real e percentuais da pessoa; régua cobre renda fora do intervalo', () => {
    const html = renderToString(<SimulatorView id="m1-l2" locale="pt-BR" userContext={ctx} />);
    expect(plain(html)).toContain('Começa com a sua renda e os seus gastos de novembro');
    expect(html).toContain('value="2500"'); // renda
    expect(html).toContain('value="40"'); // necessidades: 100.000 / 250.000
    expect(html).toContain('value="32"'); // desejos: 80.000 / 250.000
    const rich = renderToString(
      <SimulatorView id="m1-l2" locale="pt-BR" userContext={{ ...ctx, incomeCents: 900_000 }} />,
    );
    expect(rich).toContain('max="9000"'); // acima dos R$ 6.000 didáticos
  });

  it('M1-L2 Fatias sem contexto: 55/30 e R$ 2.000', () => {
    const html = renderToString(<SimulatorView id="m1-l2" locale="pt-BR" userContext={null} />);
    expect(html).toContain('value="2000"');
    expect(html).toContain('value="55"');
    expect(html).toContain('value="30"');
  });

  it('M1-L3 Bisturi: as assinaturas reais no lugar da lista genérica', () => {
    const t = render('m1-l3', ctx);
    expect(t).toContain('Netflix');
    expect(t).toContain('Spotify');
    expect(t).toContain('R$ 55,90');
    expect(t).toContain('Estas são as assinaturas que o Tostão achou no seu extrato');
    expect(t).not.toContain('Plano celular pós-pago');
  });

  it('M1-L3 Bisturi sem assinaturas: a lista didática com o celular já marcado', () => {
    const t = render('m1-l3', { ...ctx, subscriptions: [] });
    expect(t).toContain('Plano celular pós-pago');
    expect(t).not.toContain('achou no seu extrato');
  });

  it('M4-L5 Termômetro: saldo das contas e custo do mês; sem contexto 3.600 e 1.800', () => {
    const real = renderToString(<SimulatorView id="m4-l5" locale="pt-BR" userContext={ctx} />);
    expect(real).toContain('value="4000"'); // saldo R$ 4.000
    expect(real).toContain('value="1000"'); // necessidades R$ 1.000
    expect(plain(real)).toContain('Saldo das suas contas e custo do mês já estão aí');
    const didatico = renderToString(<SimulatorView id="m4-l5" locale="pt-BR" userContext={null} />);
    expect(didatico).toContain('value="3600"');
    expect(didatico).toContain('value="1800"');
  });

  it('lições sem personalização ignoram o contexto (o mesmo markup com e sem)', () => {
    for (const id of ['m2-l1', 'm6-l1', 'm9-l2']) {
      expect(renderToString(<SimulatorView id={id} locale="pt-BR" userContext={ctx} />), id).toBe(
        renderToString(<SimulatorView id={id} locale="pt-BR" userContext={null} />),
      );
    }
  });
});

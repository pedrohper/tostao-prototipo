// T4.3 · avisos da Home sem duplicação: o achado do Tostão cobre o aviso local equivalente; no máximo 2 no total.
import { describe, expect, it } from 'vitest';
import { MAX_HOME_ALERTS, unifyAlerts, type LocalAlertKey } from './home-alerts';

const ins = (id: string, kind: string, severity = 'info') => ({ id, kind, severity });

describe('unifyAlerts()', () => {
  it('achado de limite estourado esconde o aviso local de limite (mesma informação)', () => {
    const r = unifyAlerts({ insights: [ins('1', 'budget_alert', 'warning')], local: ['overBudget'] });
    expect(r.insights.map((i) => i.id)).toEqual(['1']);
    expect(r.local).toEqual([]);
  });

  it('achado de pendentes esconde o aviso local de pendentes', () => {
    const r = unifyAlerts({ insights: [ins('1', 'uncategorized_batch')], local: ['uncategorized', 'subscriptions'] });
    expect(r.local).toEqual(['subscriptions']);
  });

  it('sem achado equivalente, o aviso local fica', () => {
    const r = unifyAlerts({ insights: [ins('1', 'goal_off_track')], local: ['overBudget', 'uncategorized'], max: 3 });
    expect(r.local).toEqual(['overBudget', 'uncategorized']);
    expect(r.insights).toHaveLength(1);
  });

  it(`no máximo ${MAX_HOME_ALERTS} cartões no total, achados e avisos juntos`, () => {
    const r = unifyAlerts({
      insights: [
        ins('1', 'month_shortfall', 'urgent'),
        ins('2', 'goal_off_track', 'warning'),
        ins('3', 'next_month_tight'),
      ],
      local: ['overBudget', 'uncategorized', 'deliveryTip', 'monthlyClosing', 'subscriptions'],
    });
    expect(r.insights.length + r.local.length).toBe(MAX_HOME_ALERTS);
  });

  it('prioridade: urgente > limite estourado > pendentes > dica > rotina', () => {
    const all: LocalAlertKey[] = ['subscriptions', 'monthlyClosing', 'deliveryTip', 'uncategorized', 'overBudget'];
    const r = unifyAlerts({ insights: [], local: all, max: 5 });
    expect(r.local).toEqual(['overBudget', 'uncategorized', 'deliveryTip', 'monthlyClosing', 'subscriptions']);
    const urgent = unifyAlerts({ insights: [ins('u', 'month_shortfall', 'urgent')], local: ['overBudget'], max: 1 });
    expect(urgent.insights.map((i) => i.id)).toEqual(['u']);
    expect(urgent.local).toEqual([]);
  });

  it('achado informativo cede lugar ao aviso local de limite estourado', () => {
    const r = unifyAlerts({ insights: [ins('i', 'goal_off_track', 'info')], local: ['overBudget'], max: 1 });
    expect(r.local).toEqual(['overBudget']);
    expect(r.insights).toEqual([]);
  });

  it('empate de prioridade respeita a ordem de chegada', () => {
    const r = unifyAlerts({ insights: [ins('a', 'x'), ins('b', 'y')], local: [], max: 2 });
    expect(r.insights.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('listas vazias e max 0 não quebram', () => {
    expect(unifyAlerts({ insights: [], local: [] })).toEqual({ insights: [], local: [] });
    expect(unifyAlerts({ insights: [ins('1', 'x')], local: ['overBudget'], max: 0 })).toEqual({
      insights: [],
      local: [],
    });
  });

  it('preserva o tipo completo do achado (o quadro precisa de todos os campos)', () => {
    const full = { id: '1', kind: 'budget_alert', severity: 'info', title: 'T', body: 'B' };
    const r = unifyAlerts({ insights: [full], local: [] });
    expect(r.insights[0]).toBe(full);
  });
});

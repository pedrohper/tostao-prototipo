// T5.2 · datas e identidade das recorrências (funções puras).
import { describe, expect, it } from 'vitest';
import type { RecurringRule } from '../domain/entities.js';
import { dueAt, nextDay, occurrenceDescription, occurrencesInMonth, recurringExternalId } from './recurrence.js';

const rule = (over: Partial<RecurringRule> = {}): RecurringRule => ({
  id: 'r1',
  userId: 'u1',
  accountId: null,
  categoryId: null,
  kind: 'saida',
  description: 'Aluguel',
  amountInCents: 100_00,
  frequency: 'MONTHLY',
  dayOfMonth: 31,
  totalInstallments: null,
  postedInstallments: 0,
  autoPost: true,
  nextRunAt: dueAt('2026-01-31', 'America/Sao_Paulo'),
  active: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

describe('nextDay', () => {
  it('mensal no dia 31: fevereiro cai no 28 e março VOLTA pro 31 (o dia fixo da regra não escorrega)', () => {
    const r = rule();
    const feb = nextDay(r, '2026-01-31');
    expect(feb).toBe('2026-02-28');
    expect(nextDay(r, feb)).toBe('2026-03-31');
    expect(nextDay(r, '2026-03-31')).toBe('2026-04-30');
  });
  it('fevereiro bissexto e virada de ano', () => {
    expect(nextDay(rule(), '2028-01-31')).toBe('2028-02-29');
    expect(nextDay(rule({ dayOfMonth: 15 }), '2026-12-15')).toBe('2027-01-15');
  });
  it('semanal soma 7 dias; quinzenal soma 14', () => {
    expect(nextDay(rule({ frequency: 'WEEKLY' }), '2026-11-27')).toBe('2026-12-04');
    expect(nextDay(rule({ frequency: 'BIWEEKLY' }), '2026-12-25')).toBe('2027-01-08');
  });
});

describe('dueAt', () => {
  it('é o meio-dia do dia civil NO FUSO da pessoa (Manaus = UTC-4)', () => {
    expect(dueAt('2026-11-20', 'America/Manaus').toISOString()).toBe('2026-11-20T16:00:00.000Z');
    expect(dueAt('2026-11-20', 'America/Sao_Paulo').toISOString()).toBe('2026-11-20T15:00:00.000Z');
  });
});

describe('recurringExternalId', () => {
  it('mensal: rec:<regra>:<AAAA-MM>; semanal/quinzenal: dia inteiro (há mais de um por mês)', () => {
    expect(recurringExternalId({ id: 'abc', frequency: 'MONTHLY' }, '2026-11-05')).toBe('rec:abc:2026-11');
    expect(recurringExternalId({ id: 'abc', frequency: 'WEEKLY' }, '2026-11-05')).toBe('rec:abc:2026-11-05');
    expect(recurringExternalId({ id: 'abc', frequency: 'BIWEEKLY' }, '2026-11-19')).toBe('rec:abc:2026-11-19');
  });
});

describe('occurrenceDescription', () => {
  it('parcelado mostra n/total; sem fim, só o nome', () => {
    expect(occurrenceDescription({ description: 'Notebook', totalInstallments: 12 }, 3)).toBe('Notebook (3/12)');
    expect(occurrenceDescription({ description: 'Netflix', totalInstallments: null }, 3)).toBe('Netflix');
  });
});

describe('occurrencesInMonth', () => {
  it('mensal: um vencimento por mês, na numeração certa da parcela', () => {
    const r = rule({
      dayOfMonth: 10,
      nextRunAt: dueAt('2026-12-10', 'America/Sao_Paulo'),
      totalInstallments: 3,
      postedInstallments: 1,
    });
    expect(occurrencesInMonth(r, '2026-12', 'America/Sao_Paulo')).toEqual([{ day: '2026-12-10', n: 2 }]);
    expect(occurrencesInMonth(r, '2027-01', 'America/Sao_Paulo')).toEqual([{ day: '2027-01-10', n: 3 }]);
    // acabou: parcela 4 não existe
    expect(occurrencesInMonth(r, '2027-02', 'America/Sao_Paulo')).toEqual([]);
  });
  it('semanal: 4 ou 5 vencimentos no mês', () => {
    const r = rule({ frequency: 'WEEKLY', nextRunAt: dueAt('2026-12-04', 'America/Sao_Paulo') });
    expect(occurrencesInMonth(r, '2026-12', 'America/Sao_Paulo').map((o) => o.day)).toEqual([
      '2026-12-04',
      '2026-12-11',
      '2026-12-18',
      '2026-12-25',
    ]);
  });
  it('mês anterior ao próximo vencimento: nada', () => {
    expect(
      occurrencesInMonth(rule({ nextRunAt: dueAt('2026-12-31', 'America/Sao_Paulo') }), '2026-11', 'America/Sao_Paulo'),
    ).toEqual([]);
  });
});

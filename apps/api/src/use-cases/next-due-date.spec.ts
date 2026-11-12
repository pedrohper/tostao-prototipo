import { describe, expect, it } from 'vitest';
import { nextDueDate } from './get-month-summary.js';

describe('nextDueDate', () => {
  const now = new Date('2026-11-12T14:00:00Z');
  it('empurra vencimento que já passou pro mês seguinte', () => {
    expect(nextDueDate(new Date('2026-11-01T03:00:00Z'), now).toISOString()).toBe('2026-12-01T03:00:00.000Z');
  });
  it('mantém vencimento futuro', () => {
    expect(nextDueDate(new Date('2026-11-20T03:00:00Z'), now).toISOString()).toBe('2026-11-20T03:00:00.000Z');
  });
  it('vence hoje continua hoje', () => {
    expect(nextDueDate(new Date('2026-11-12T03:00:00Z'), now).toISOString()).toBe('2026-11-12T03:00:00.000Z');
  });
  it('dia 31 vira o último dia do mês curto e volta pro 31 depois', () => {
    expect(nextDueDate(new Date('2026-01-31T03:00:00Z'), new Date('2026-02-10T00:00:00Z')).toISOString()).toBe('2026-02-28T03:00:00.000Z');
    expect(nextDueDate(new Date('2026-01-31T03:00:00Z'), new Date('2026-03-01T00:00:00Z')).toISOString()).toBe('2026-03-31T03:00:00.000Z');
  });
});

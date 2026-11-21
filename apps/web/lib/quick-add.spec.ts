// T4.4 · peças puras do "Anotar rápido": chips Hoje/Ontem, descrições recentes e sugestões.
import { describe, expect, it } from 'vitest';
import { canSaveQuickAdd, dateChip, dateForChip, recentDescriptions, shiftDay, suggestDescriptions } from './quick-add';

describe('shiftDay()', () => {
  it('soma e subtrai dias de calendário, virando mês e ano', () => {
    expect(shiftDay('2026-11-21', -1)).toBe('2026-11-20');
    expect(shiftDay('2026-12-01', -1)).toBe('2026-11-30');
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftDay('2026-11-30', 1)).toBe('2026-12-01');
  });

  it('respeita ano bissexto e não sofre com horário de verão', () => {
    expect(shiftDay('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2026-10-18', 1)).toBe('2026-10-19');
  });

  it('data inválida volta como veio (o formulário não quebra)', () => {
    expect(shiftDay('ontem', -1)).toBe('ontem');
  });
});

describe('chips de data', () => {
  const today = '2026-11-21';

  it('Hoje e Ontem preenchem a data (relativa ao "hoje" do servidor, não do navegador)', () => {
    expect(dateForChip('hoje', today)).toBe('2026-11-21');
    expect(dateForChip('ontem', today)).toBe('2026-11-20');
  });

  it('o chip ativo acompanha a data escolhida; qualquer outra é "outra"', () => {
    expect(dateChip('2026-11-21', today)).toBe('hoje');
    expect(dateChip('2026-11-20', today)).toBe('ontem');
    expect(dateChip('2026-11-19', today)).toBe('outra');
    expect(dateChip('2026-11-22', today)).toBe('outra'); // futuro (conta a vencer) continua permitido
  });

  it('virada de mês: ontem do dia 1 é o último dia do mês anterior', () => {
    expect(dateForChip('ontem', '2026-12-01')).toBe('2026-11-30');
    expect(dateChip('2026-11-30', '2026-12-01')).toBe('ontem');
  });
});

describe('recentDescriptions()', () => {
  const tx = (description: string, occurredAt: string, extra: Record<string, unknown> = {}) => ({
    description,
    occurredAt,
    source: 'manual' as const,
    ...extra,
  });

  it('mais recente primeiro, sem repetir (ignora caixa e acento)', () => {
    const r = recentDescriptions([
      tx('Almoço', '2026-11-10T12:00:00Z'),
      tx('almoco', '2026-11-18T12:00:00Z'),
      tx('Uber', '2026-11-15T12:00:00Z'),
    ]);
    expect(r).toEqual(['almoco', 'Uber']);
  });

  it('descrição de banco não vira sugestão, a menos que a pessoa tenha dado apelido', () => {
    const r = recentDescriptions([
      tx('PIX ENVIADO 12.345.678/0001-90', '2026-11-18T12:00:00Z', { source: 'bank' }),
      tx('COMPRA CARTAO 9981', '2026-11-17T12:00:00Z', { source: 'bank', customDescription: 'Mercado da esquina' }),
    ]);
    expect(r).toEqual(['Mercado da esquina']);
  });

  it('respeita o limite e ignora vazio e texto gigante', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      tx(`Item ${i}`, `2026-11-${String(i + 1).padStart(2, '0')}T12:00:00Z`),
    );
    expect(recentDescriptions(many, 5)).toHaveLength(5);
    expect(recentDescriptions([tx('   ', '2026-11-01T00:00:00Z'), tx('x'.repeat(61), '2026-11-02T00:00:00Z')])).toEqual(
      [],
    );
  });
});

describe('suggestDescriptions()', () => {
  const recents = ['Almoço no trabalho', 'Uber', 'Pizza do Zé', 'Mercado', 'Almoço'];

  it('sem texto, mostra as mais recentes', () => {
    expect(suggestDescriptions(recents, '', 3)).toEqual(['Almoço no trabalho', 'Uber', 'Pizza do Zé']);
  });

  it('"começa com" vem antes de "contém"; ignora acento e caixa', () => {
    expect(suggestDescriptions(recents, 'alm')).toEqual(['Almoço no trabalho', 'Almoço']);
    expect(suggestDescriptions(recents, 'ze')).toEqual(['Pizza do Zé']);
    expect(suggestDescriptions(['Pizza', 'Zé da pizza'], 'pizza')).toEqual(['Zé da pizza']);
  });

  it('o que já está igual ao digitado sai da lista, e sem casamento não sugere nada', () => {
    expect(suggestDescriptions(recents, 'uber')).toEqual([]);
    expect(suggestDescriptions(recents, 'xyz')).toEqual([]);
  });
});

describe('canSaveQuickAdd()', () => {
  it('precisa de valor maior que zero e de descrição não vazia', () => {
    expect(canSaveQuickAdd({ cents: 1250, description: 'Almoço' })).toBe(true);
    expect(canSaveQuickAdd({ cents: null, description: 'Almoço' })).toBe(false);
    expect(canSaveQuickAdd({ cents: 0, description: 'Almoço' })).toBe(false);
    expect(canSaveQuickAdd({ cents: 1250, description: '   ' })).toBe(false);
  });
});

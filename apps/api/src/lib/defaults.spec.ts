import { describe, expect, it } from 'vitest';
import { categorizeByRules } from '../services/categorize.js';
import type { CategoryRule } from '../domain/entities.js';
import { normalizeDescription } from './text.js';
import { DEFAULT_CATEGORIES, DEFAULT_RULES } from './defaults.js';

const rules: CategoryRule[] = DEFAULT_RULES.map((r, i) => ({ id: String(i), userId: null, ...r }));
const cat = (description: string) => categorizeByRules(description, rules);

const NOVAS_SAIDA = ['pets', 'beleza', 'viagem', 'presentes', 'taxas', 'dividas', 'investimentos'];
const NOVAS_ENTRADA = ['freela', 'reembolso', 'rendimentos'];
// Paleta suave do design system (tons de fundo já usados pelas categorias do sistema).
const CORES_SUAVES = ['#FFE1E7', '#FFF1C7', '#DDF6E8', '#DCEBFF', '#F6EFE4'];

describe('DEFAULT_CATEGORIES', () => {
  it('ids únicos e nomes únicos (o seed usa o id como chave do upsert)', () => {
    const ids = DEFAULT_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const nomes = DEFAULT_CATEGORIES.map((c) => c.name.toLowerCase());
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it('mantém todos os ids que já existiam (compatibilidade com o banco e com as regras)', () => {
    const antigos = [
      'delivery',
      'comer-fora',
      'mercado',
      'assinaturas',
      'transporte',
      'role',
      'casa',
      'saude',
      'estudo',
      'compras',
      'jogos',
      'apostas',
      'outros',
      'salario',
      'entrada-outros',
      'nao-conta',
    ];
    const ids = DEFAULT_CATEGORIES.map((c) => c.id);
    for (const id of antigos) expect(ids).toContain(id);
  });

  it('traz as 10 categorias novas, com nome, tipo e cor suave', () => {
    const byId = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));
    const nomes: Record<string, string> = {
      pets: 'Pets',
      beleza: 'Beleza e cuidados',
      viagem: 'Viagem',
      presentes: 'Presentes e doações',
      taxas: 'Impostos e taxas',
      dividas: 'Dívidas e parcelas',
      investimentos: 'Investimentos / Reserva',
      freela: 'Freela / Extra',
      reembolso: 'Reembolso',
      rendimentos: 'Rendimentos',
    };
    for (const id of NOVAS_SAIDA) expect(byId.get(id)?.kind).toBe('saida');
    for (const id of NOVAS_ENTRADA) expect(byId.get(id)?.kind).toBe('entrada');
    for (const [id, nome] of Object.entries(nomes)) {
      const c = byId.get(id)!;
      expect(c.name).toBe(nome);
      expect(CORES_SUAVES).toContain(c.color);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.userId).toBeUndefined();
    }
  });
});

describe('DEFAULT_RULES', () => {
  it('toda regra aponta pra uma categoria existente', () => {
    const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
    for (const r of DEFAULT_RULES) expect(ids.has(r.categoryId), `${r.pattern} → ${r.categoryId}`).toBe(true);
  });

  it('padrões já vêm em maiúsculas e sem acento (é assim que a comparação é feita)', () => {
    for (const r of DEFAULT_RULES) expect(r.pattern.trimEnd(), r.pattern).toBe(normalizeDescription(r.pattern));
  });

  it('não repete o mesmo padrão em duas categorias', () => {
    const seen = new Map<string, string>();
    for (const r of DEFAULT_RULES) {
      expect(seen.get(r.pattern), `padrão repetido: ${r.pattern}`).toBeUndefined();
      seen.set(r.pattern, r.categoryId);
    }
  });

  it('cada categoria nova tem ao menos uma regra óbvia, exceto as de uso livre', () => {
    const comRegra = new Set(DEFAULT_RULES.map((r) => r.categoryId));
    for (const id of [...NOVAS_SAIDA, ...NOVAS_ENTRADA]) expect(comRegra.has(id), id).toBe(true);
  });

  it.each([
    ['PETZ SAO PAULO', 'pets'],
    ['Cobasi Pet Center', 'pets'],
    ['BARBEARIA DO ZE', 'beleza'],
    ['Drogaria Pacheco', 'saude'],
    ['BUSER BRASIL', 'viagem'],
    ['Clickbus Passagens', 'viagem'],
    ['Airbnb * HMABC', 'viagem'],
    ['DARF 0190', 'taxas'],
    ['IPVA 2026 PARCELA 1', 'taxas'],
    ['PAGTO EMPRESTIMO CONSIGNADO', 'dividas'],
    ['TESOURO DIRETO APLICACAO', 'investimentos'],
    ['Vaquinha da turma', 'presentes'],
    ['PIX RECEBIDO FREELA SITE', 'freela'],
    ['ESTORNO COMPRA', 'reembolso'],
    ['REMUNERACAO REND PAGO APLIC', 'rendimentos'],
    ['Rendimento poupança', 'rendimentos'],
  ])('"%s" → %s', (descricao, esperada) => {
    expect(cat(descricao)).toBe(esperada);
  });

  it('não dá falso positivo em nomes comuns que contêm pedaços dos padrões', () => {
    // "PET" dentro de PETROBRAS, "NATURA" dentro de "NATURAL", "IOF" em palavra maior, "UBER" não é viagem.
    expect(cat('POSTO PETROBRAS')).toBe('transporte');
    expect(cat('SUCO NATURAL LANCHES')).toBeNull();
    expect(cat('FIOFO LANCHES')).toBeNull();
    expect(cat('IOF COMPRA INTERNACIONAL')).toBe('taxas');
    expect(cat('UBER *TRIP')).toBe('transporte');
    expect(cat('MERCADINHO PETISCOS')).toBeNull();
  });

  it('pagamento de fatura e transferência não caem em Dívidas', () => {
    expect(cat('PAGAMENTO FATURA CARTAO NUBANK')).toBeNull();
    expect(cat('TRANSFERENCIA ENVIADA PIX')).toBeNull();
  });
});

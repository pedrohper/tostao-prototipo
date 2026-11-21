import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FAQ, FEATURES, PLANS, VITRINE_TABS } from './landing-content';

const everything = JSON.stringify({ VITRINE_TABS, FEATURES, PLANS, FAQ });
const landingSource = readFileSync(fileURLToPath(new URL('../app/(site)/landing.tsx', import.meta.url)), 'utf8');

describe('landing comercial: o que não pode faltar', () => {
  it('a vitrine tem as 5 telas pedidas, na ordem, cada uma com texto e descrição pro leitor de tela', () => {
    expect(VITRINE_TABS.map((t) => t.id)).toEqual(['inicio', 'chat', 'whatsapp', 'assinaturas', 'simuladores']);
    for (const t of VITRINE_TABS) {
      expect(t.label.length, t.id).toBeGreaterThan(2);
      expect(t.bullets.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.mockAlt, t.id).toContain('dados fictícios');
    }
  });

  it('"Tudo num lugar só" destaca explicitamente os 6 recursos do plano', () => {
    const titles = FEATURES.map((f) => f.title).join(' | ');
    for (const must of [
      'Open Finance',
      'planilha automática',
      'Chat com IA',
      'WhatsApp',
      'Tostão Automático',
      'Previsão de 3 meses',
      'Acertos com amigos',
      '45 lições',
    ])
      expect(titles).toContain(must);
    expect(FEATURES).toHaveLength(6);
  });

  it('planos: beta aberto grátis com botão e plano completo "em breve" sem preço e sem botão', () => {
    const [beta, completo] = PLANS;
    expect(beta).toMatchObject({ id: 'beta', price: 'Grátis no lançamento', cta: 'Começar grátis' });
    expect(completo).toMatchObject({ id: 'completo', badge: 'Em breve', cta: null });
    expect(completo!.price).toBe('Ainda sem preço');
    expect(beta!.bullets.join(' ')).toContain('sem venda de dados');
    expect(completo!.bullets.join(' ')).toContain('Nunca vamos vender seus dados');
  });

  it('FAQ responde as 3 objeções de confiança: segurança do Open Finance, uso sem banco e cancelar/LGPD', () => {
    const q = Object.fromEntries(FAQ.map((f) => [f.id, f]));
    expect(q.seguranca!.answer).toMatch(/Open Finance/);
    expect(q.seguranca!.answer).toMatch(/só leitura/);
    expect(q['sem-banco']!.answer).toMatch(/Dá\./);
    expect(q.cancelar!.answer).toMatch(/LGPD/);
    expect(q.cancelar!.link?.href).toBe('/privacidade');
    expect(FAQ.length).toBeGreaterThanOrEqual(5);
    expect(new Set(FAQ.map((f) => f.id)).size).toBe(FAQ.length);
  });
});

describe('landing comercial: o que não pode aparecer', () => {
  it('nenhuma restrição de idade ("20 anos") no conteúdo nem na página', () => {
    expect(everything).not.toMatch(/\b20 anos\b/);
    expect(landingSource).not.toMatch(/todo mundo de 20 anos/);
    expect(landingSource).not.toMatch(/\b20 anos\b/);
  });

  it('não promete preço, desconto nem "grátis pra sempre"', () => {
    expect(everything).not.toMatch(/R\$\s?\d/);
    expect(everything).not.toMatch(/pra sempre|para sempre|vital[ií]cio|desconto/i);
  });

  it('não inventa prova social (depoimento, nota, "milhares de usuários")', () => {
    expect(everything).not.toMatch(/depoimento|milhares|mil usu[aá]rios|estrelas|\bnota \d/i);
  });

  it('a página inclui as seções novas (vitrine, recursos, planos e FAQ) com âncoras', () => {
    for (const id of ['id="app"', 'id="recursos"', 'id="planos"', 'id="faq"']) expect(landingSource).toContain(id);
    expect(landingSource).toContain('LandingVitrine');
  });
});

// T2.5 · dados do responsável vêm de NEXT_PUBLIC_* (nunca do código) e, sem configuração, nada é inventado.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanCnpj, cleanEmail, getLegalConfig, resolveLegalConfig } from './legal-config';

describe('resolveLegalConfig · fallback seguro', () => {
  it('sem nenhuma variável: sem e-mail, sem CNPJ, razão social só "Tostão"', () => {
    expect(resolveLegalConfig({})).toEqual({ supportEmail: null, dpoEmail: null, entity: 'Tostão', cnpj: null });
  });

  it('variáveis vazias ou só espaços valem como ausentes', () => {
    const cfg = resolveLegalConfig({
      NEXT_PUBLIC_SUPPORT_EMAIL: '  ',
      NEXT_PUBLIC_DPO_EMAIL: '',
      NEXT_PUBLIC_LEGAL_ENTITY: '   ',
      NEXT_PUBLIC_LEGAL_CNPJ: '',
    });
    expect(cfg).toEqual({ supportEmail: null, dpoEmail: null, entity: 'Tostão', cnpj: null });
  });

  it('o fallback nunca é um e-mail pessoal nem aponta pra infraestrutura interna', () => {
    expect(JSON.stringify(resolveLegalConfig({}))).not.toMatch(/gmail|hotmail|tailscale|localhost/i);
  });
});

describe('resolveLegalConfig · valores configurados', () => {
  const env = {
    NEXT_PUBLIC_SUPPORT_EMAIL: ' Suporte@Tostao.EXEMPLO.com.br ',
    NEXT_PUBLIC_DPO_EMAIL: 'dpo@tostao.exemplo.com.br',
    NEXT_PUBLIC_LEGAL_ENTITY: 'Tostão Tecnologia Ltda.',
    NEXT_PUBLIC_LEGAL_CNPJ: '11222333000181',
  };

  it('normaliza e-mail (minúsculas, sem espaços) e formata o CNPJ', () => {
    expect(resolveLegalConfig(env)).toEqual({
      supportEmail: 'suporte@tostao.exemplo.com.br',
      dpoEmail: 'dpo@tostao.exemplo.com.br',
      entity: 'Tostão Tecnologia Ltda.',
      cnpj: '11.222.333/0001-81',
    });
  });

  it('o DPO cai pro e-mail de suporte quando não há e-mail próprio', () => {
    const cfg = resolveLegalConfig({ NEXT_PUBLIC_SUPPORT_EMAIL: 'suporte@tostao.exemplo.com.br' });
    expect(cfg.dpoEmail).toBe('suporte@tostao.exemplo.com.br');
  });

  it('e-mail de suporte inválido é descartado (não vira mailto: quebrado)', () => {
    expect(cleanEmail('nao-e-email')).toBeNull();
    expect(cleanEmail('a@b')).toBeNull();
    expect(cleanEmail('a b@c.com')).toBeNull();
    expect(cleanEmail('"><script>@x.com')).toBeNull();
    expect(cleanEmail('x@dominio.com.br')).toBe('x@dominio.com.br');
  });

  it('razão social: tira caractere de controle e < >, e limita o tamanho', () => {
    const cfg = resolveLegalConfig({ NEXT_PUBLIC_LEGAL_ENTITY: '<b>Tostão</b>\u0000 Ltda' });
    expect(cfg.entity).toBe('bTostão/b Ltda');
    expect(resolveLegalConfig({ NEXT_PUBLIC_LEGAL_ENTITY: 'x'.repeat(500) }).entity).toHaveLength(120);
  });
});

describe('cleanCnpj', () => {
  it('aceita com e sem máscara quando os dígitos verificadores batem', () => {
    expect(cleanCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81');
    expect(cleanCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
  it('rejeita dígito errado, tamanho errado e sequência repetida', () => {
    expect(cleanCnpj('11.222.333/0001-82')).toBeNull();
    expect(cleanCnpj('1122233300018')).toBeNull();
    expect(cleanCnpj('00000000000000')).toBeNull();
    expect(cleanCnpj('abc')).toBeNull();
    expect(cleanCnpj(undefined)).toBeNull();
  });
});

describe('getLegalConfig lê as 4 variáveis NEXT_PUBLIC_*', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('pega do ambiente', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', 'ajuda@tostao.exemplo.com.br');
    vi.stubEnv('NEXT_PUBLIC_LEGAL_ENTITY', 'Tostão SA');
    vi.stubEnv('NEXT_PUBLIC_LEGAL_CNPJ', '11222333000181');
    expect(getLegalConfig()).toMatchObject({
      supportEmail: 'ajuda@tostao.exemplo.com.br',
      entity: 'Tostão SA',
      cnpj: '11.222.333/0001-81',
    });
  });

  it('o código de legal-config usa o acesso literal de cada variável (é o que o Next troca no build)', () => {
    const src = readFileSync(join(__dirname, 'legal-config.ts'), 'utf8');
    for (const name of ['SUPPORT_EMAIL', 'DPO_EMAIL', 'LEGAL_ENTITY', 'LEGAL_CNPJ']) {
      expect(src).toContain(`process.env.NEXT_PUBLIC_${name}`);
    }
  });
});

describe('.env.example da web documenta as 4 variáveis (sem e-mail pessoal nem infraestrutura interna)', () => {
  const example = readFileSync(join(__dirname, '..', '.env.example'), 'utf8');

  it.each(['NEXT_PUBLIC_SUPPORT_EMAIL', 'NEXT_PUBLIC_DPO_EMAIL', 'NEXT_PUBLIC_LEGAL_ENTITY', 'NEXT_PUBLIC_LEGAL_CNPJ'])(
    '%s está lá, vazia por padrão',
    (name) => {
      expect(example).toMatch(new RegExp(`^${name}=""$`, 'm'));
    },
  );

  it('sem e-mail pessoal, infraestrutura interna, texto de rascunho ou comando de desenvolvedor', () => {
    const dev = ['pnpm', 'dev'].join(' ');
    const banned = new RegExp(['gmail', 'tail' + 'scale', 'home' + 'lab', 'prot' + 'ótipo'].join('|'), 'i');
    expect(example).not.toMatch(banned);
    expect(example).not.toContain(dev);
  });
});

describe('componentes que usam a configuração', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('Contato: mostra o e-mail configurado como mailto; sem e-mail, texto genérico (sem mailto inventado)', async () => {
    const { Contato, Controlador } = await import('../app/(site)/legal');
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', 'ajuda@tostao.exemplo.com.br');
    vi.stubEnv('NEXT_PUBLIC_DPO_EMAIL', 'dpo@tostao.exemplo.com.br');
    expect(renderToString(<Contato />)).toContain('href="mailto:ajuda@tostao.exemplo.com.br"');
    expect(renderToString(<Contato dpo />)).toContain('href="mailto:dpo@tostao.exemplo.com.br"');

    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', '');
    vi.stubEnv('NEXT_PUBLIC_DPO_EMAIL', '');
    const html = renderToString(<Contato dpo />);
    expect(html).not.toContain('mailto:');
    expect(html).toContain('canal de suporte');

    vi.stubEnv('NEXT_PUBLIC_LEGAL_ENTITY', 'Tostão Tecnologia Ltda.');
    vi.stubEnv('NEXT_PUBLIC_LEGAL_CNPJ', '11222333000181');
    expect(renderToString(<Controlador />)).toContain('Tostão Tecnologia Ltda., CNPJ 11.222.333/0001-81');
    vi.stubEnv('NEXT_PUBLIC_LEGAL_CNPJ', '');
    expect(renderToString(<Controlador />)).not.toContain('CNPJ');
  });

  it('SupportBanner só aparece com e-mail configurado', async () => {
    const { SupportBanner } = await import('../components/support-banner');
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', '');
    expect(renderToString(<SupportBanner text="Ajuda?" />)).toBe('');
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', 'ajuda@tostao.exemplo.com.br');
    const html = renderToString(<SupportBanner text="Ajuda?" />);
    expect(html).toContain('mailto:ajuda@tostao.exemplo.com.br');
    expect(html).toContain('Ajuda?');
  });
});

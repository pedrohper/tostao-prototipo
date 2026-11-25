// T2.5 · Política de Privacidade e Termos: sem texto de pessoa física/infraestrutura caseira, com TODOS os cookies
// reais e os suboperadores reais. Lê o código-fonte das páginas (são Server Components assíncronos) e cruza com as
// constantes de cookie do código, pra a política não ficar desatualizada quando um cookie novo for criado.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLASH_COOKIE } from './flash-toast';
import { PREFS_COOKIE } from './inicio-prefs';
import { LOCALE_COOKIE } from './i18n';
import { OAUTH_COOKIE } from './oauth';
import { REFRESH_COOKIE, TOKEN_COOKIE } from './session-constants';
import { THEME_COOKIE } from './theme';

const site = join(__dirname, '..', 'app', '(site)');
const privacy = readFileSync(join(site, 'privacidade', 'page.tsx'), 'utf8');
const terms = readFileSync(join(site, 'termos', 'page.tsx'), 'utf8');
const legal = readFileSync(join(site, 'legal.tsx'), 'utf8');

describe('Política de Privacidade', () => {
  it('lista TODOS os cookies que o app realmente grava', () => {
    for (const cookie of [
      TOKEN_COOKIE,
      REFRESH_COOKIE,
      OAUTH_COOKIE,
      THEME_COOKIE,
      PREFS_COOKIE,
      LOCALE_COOKIE,
      FLASH_COOKIE,
    ]) {
      expect(privacy, `cookie ${cookie} sumiu da política`).toContain(`<td>${cookie}</td>`);
    }
  });

  it('lista os suboperadores reais', () => {
    for (const name of ['Pluggy', 'DeepSeek', 'Resend', 'Meta (WhatsApp Cloud API)', 'hospedagem', 'Sentry']) {
      expect(privacy, name).toContain(name);
    }
    expect(privacy).toContain('mascaramos');
    expect(privacy).toMatch(/só depois do seu aceite/);
  });

  it('conta o que o "Isso é golpe?" manda pra IA, e o aviso do app diz o mesmo', () => {
    const card = readFileSync(join(__dirname, '..', 'components', 'ai-consent-card.tsx'), 'utf8');
    for (const src of [privacy, card]) {
      expect(src).toContain('Isso é golpe?');
      expect(src.replace(/\s+/g, ' ')).toMatch(/não (a )?guarda(da)?/);
      expect(src.replace(/\s+/g, ' ')).toMatch(/[Nn]omes? de outras? pessoas?/);
    }
    expect(privacy).toContain('documento="privacidade"');
  });

  it('cita os direitos do titular, incluindo o download dos dados no Perfil', () => {
    expect(privacy).toContain('LGPD (art. 18)');
    expect(privacy).toContain('Baixar meus dados (JSON)');
    expect(privacy).toContain('ANPD');
  });

  it('o responsável e o DPO vêm da configuração, não do texto', () => {
    expect(privacy).toContain('<Controlador />');
    expect(privacy).toContain('<Contato dpo />');
    expect(privacy).not.toMatch(/pessoa física/i);
    expect(privacy).not.toMatch(/servidor próprio/i);
  });
});

describe('Termos e legal.tsx', () => {
  it('sem pessoa física, servidor próprio nem e-mail escrito no código', () => {
    for (const src of [terms, legal]) {
      expect(src).not.toMatch(/pessoa física|servidor próprio|@gmail\.com/i);
    }
    expect(terms).toContain('<Controlador />');
    expect(terms).toContain('<Contato />');
  });

  it('o e-mail e o CNPJ vêm de getLegalConfig (variáveis NEXT_PUBLIC_*)', () => {
    expect(legal).toContain('getLegalConfig');
    expect(legal).not.toMatch(/CONTATO_EMAIL/);
  });
});

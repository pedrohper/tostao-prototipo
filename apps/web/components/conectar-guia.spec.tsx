import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConectarGuia, WidgetErrorAlert } from './conectar-guia';
import { hasTechnicalLeak, humanizeWidgetError } from '../lib/conectar-widget';

const webRoot = join(__dirname, '..');

describe('ConectarGuia (T6.5)', () => {
  const html = renderToString(<ConectarGuia />);

  it('exibe os 3 passos curtos para leigo na ordem certa, sem Item ID', () => {
    const step1 = html.indexOf('1. Cria sua conta no MeuPluggy');
    const step2 = html.indexOf('2. Volta aqui e toca em');
    const step3 = html.indexOf('3. Escolhe MeuPluggy e autoriza');

    expect(step1).toBeGreaterThan(-1);
    expect(step2).toBeGreaterThan(step1);
    expect(step3).toBeGreaterThan(step2);

    expect(html).toContain('href="https://meu.pluggy.ai"');
    expect(html).not.toMatch(/Item ID|clientUserId|connect_token|API/i);
  });

  it('usa ícones existentes do Tostão nos 3 passos', () => {
    expect(html).toContain('/icones/conectar/banco.webp');
    expect(html).toContain('/icones/ui/banco.webp');
    expect(html).toContain('/icones/jogo/dia-cumprido.webp');
  });

  it('inclui o link "Por que preciso disso?" explicando que o Tostão só lê e nunca movimenta', () => {
    expect(html).toContain('Por que preciso disso?');
    expect(html).toContain('só lê seus gastos');
    expect(html).toContain('nunca faz Pix, não paga boleto nem movimenta seu dinheiro');
  });
});

describe('WidgetErrorAlert (T6.5)', () => {
  it('não renderiza nada quando não há mensagem', () => {
    expect(renderToString(<WidgetErrorAlert />)).toBe('');
  });

  it('mostra mensagem humana e alternativas de importar extrato (PDF/OFX) e anotar na mão', () => {
    const msg = humanizeWidgetError('Pluggy respondeu 500 em /items/abc', 'connect');
    const html = renderToString(<WidgetErrorAlert message={msg} importarHref="/importar?voltar=%2Fconectar" />);

    expect(html).toContain('role="alert"');
    expect(html).toContain('Importar extrato (PDF/OFX)');
    expect(html).toContain('href="/importar?voltar=%2Fconectar"');
    expect(html).toContain('Anotar na mão');
    expect(html).toContain('href="/anotar"');
    expect(hasTechnicalLeak(html)).toBe(false);
    expect(html).not.toMatch(/Item ID|500|Pluggy/i);
  });
});

describe('/conectar sem Item ID nem erro técnico na tela principal (guardas de fonte)', () => {
  const pageSrc = readFileSync(join(webRoot, 'app/(app)/conectar/page.tsx'), 'utf8');
  const formsSrc = readFileSync(join(webRoot, 'app/(app)/conectar/forms.tsx'), 'utf8');

  it('page.tsx usa ConectarGuia e não expõe advancedHint / Item ID na tela principal', () => {
    expect(pageSrc).toContain('<ConectarGuia />');
    expect(pageSrc).not.toContain('advancedHint');
    expect(pageSrc).not.toContain('howSteps');
    expect(pageSrc).not.toContain('Item ID');
  });

  it('forms.tsx humaniza todo erro do widget, usa WidgetErrorAlert e esconde haveItemId por padrão', () => {
    expect(formsSrc).toContain('humanizeWidgetError');
    expect(formsSrc).toContain('<WidgetErrorAlert');
    expect(formsSrc).toContain('allowManual &&');
    expect(formsSrc).not.toContain('labels.pluggyError');
    expect(formsSrc).not.toContain('labels.initError');
    expect(formsSrc).not.toContain('labels.fallbackError');
  });
});

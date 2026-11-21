// T4.2 · OnboardingFrame: com ?novo=1 a Nav completa some e entram progresso 1→2→3 + "Fazer depois".
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OnboardingFrame } from './onboarding-shell';

const nav = <nav data-testid="nav-completa">Início Carteira Tostão Aprender Mais</nav>;

describe('OnboardingFrame', () => {
  it('onboarding ativo: não renderiza a Nav, mostra progresso e "Fazer depois" apontando pro Início', () => {
    const html = renderToString(
      <OnboardingFrame active step={2} nav={nav}>
        <p>conteúdo do passo</p>
      </OnboardingFrame>,
    );
    expect(html).not.toContain('nav-completa');
    expect(html).toContain('conteúdo do passo');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain('aria-valuemax="3"');
    expect(html).toContain('Passo 2 de 3');
    expect(html).toContain('Fazer depois');
    expect(html).toContain('href="/inicio"');
  });

  it('renda é o passo 3 de 3', () => {
    const html = renderToString(
      <OnboardingFrame active step={3} nav={nav}>
        x
      </OnboardingFrame>,
    );
    expect(html).toContain('Passo 3 de 3');
    expect(html).toContain('width:100%');
  });

  it('fora do onboarding: layout normal, com a Nav e sem progresso', () => {
    const html = renderToString(
      <OnboardingFrame active={false} step={2} nav={nav}>
        <p>tela comum</p>
      </OnboardingFrame>,
    );
    expect(html).toContain('nav-completa');
    expect(html).toContain('tela comum');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('Fazer depois');
  });

  it('lançamento é PT-BR: mesmo pedindo "en" (i18n desligado, T2.3) os textos saem em português', () => {
    const html = renderToString(
      <OnboardingFrame active step={2} nav={nav} locale="en">
        x
      </OnboardingFrame>,
    );
    expect(html).toContain('Passo 2 de 3');
  });
});

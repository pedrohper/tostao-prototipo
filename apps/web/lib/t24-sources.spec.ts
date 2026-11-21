// T2.4 · guardas de regressão lendo o código-fonte (sem navegador): a11y, hidratação, toast único e as entregas da
// Fase 4 que a T2.4 não pode desfazer. Barato e pega o retrocesso mais provável (alguém reintroduzir window.confirm).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs|js)$/.test(name) && !/\.spec\.tsx?$/.test(name)) out.push(relative(root, full));
  }
  return out;
}
const sources = [...walk(join(root, 'app')), ...walk(join(root, 'components')), ...walk(join(root, 'lib'))];

describe('T2.4 · ações destrutivas e erros', () => {
  it('nenhum window.confirm/confirm() nativo sobrou (todos usam o ConfirmDialog)', () => {
    const offenders = sources.filter((f) => /(?<![\w.])(window\.)?confirm\(/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('as 6 ações destrutivas usam o ConfirmDialog', () => {
    for (const file of [
      'app/(app)/carteira/[id]/page.tsx', // apagar lançamento / série
      'app/(app)/meta/page.tsx', // apagar meta
      'app/(app)/whatsapp/page.tsx', // desvincular WhatsApp
      'app/(app)/conectar/forms.tsx', // desconectar banco
      'app/(app)/categorias/category-form.tsx', // apagar categoria
      'app/(app)/amigos/client.tsx', // tirar amigo do desafio
    ]) {
      expect(read(file), file).toMatch(/Confirm(SubmitButton|Action)/);
    }
  });

  it('os try/catch de erro reaproveitam o toast global da T4.1 (um único sistema)', () => {
    for (const file of [
      'components/tostao-auto-card.tsx',
      'components/avisos.tsx',
      'app/(app)/convites/copy-link.tsx',
      'app/(app)/aprender/[licao]/player.tsx',
      'app/(app)/amigos/client.tsx',
    ]) {
      const src = read(file);
      expect(src, file).toMatch(/from '(@\/components\/toast|\.\/toast)'/);
      expect(src, file).toContain('toast.error(');
    }
    const definers = sources.filter((f) => /export function ToastProvider/.test(read(f)));
    expect(definers).toEqual(['components/toast.tsx']);
  });
});

describe('T2.4 · a11y e hidratação', () => {
  it('StreakDialog, SwipeSheet e ConfirmDialog usam o hook de a11y e nomeiam o diálogo', () => {
    for (const file of ['components/streak-modal.tsx', 'components/sheet-swipe.tsx', 'components/confirm-dialog.tsx']) {
      const src = read(file);
      expect(src, file).toContain('useDialogA11y');
      expect(src, file).toContain('aria-modal="true"');
      expect(src, file).toMatch(/aria-labelledby=/);
    }
  });

  it('SwipeSheet não lê matchMedia durante o render (hydration mismatch): usa useSyncExternalStore com snapshot de servidor', () => {
    const src = read('components/sheet-swipe.tsx');
    expect(src).not.toMatch(/const reduz = typeof window/);
    expect(src).toContain('useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)');
    // matchMedia só aparece dentro das funções de subscribe/snapshot (nunca solto no corpo do componente)
    const body = src.slice(src.indexOf('export function SwipeSheet'));
    expect(body.match(/matchMedia\(/g)?.length ?? 0).toBe(1); // só o do `isDesktop` dentro de `fechar` (evento, não render)
  });

  it('icone.tsx (Server Component) não tem onError; o fallback vive num Client Component com flag anti-loop', () => {
    expect(read('components/icone.tsx')).not.toContain('onError');
    expect(read('components/icone.tsx')).toContain('ImgWithFallback');
    const img = read('components/img-with-fallback.tsx');
    expect(img).toContain("'use client'");
    expect(img).toContain('didFallback');
  });

  it('book-carousel: o container dos botões não é role="img" e cada botão tem 44 px de área', () => {
    const src = read('app/(app)/aprender/book-carousel.tsx');
    expect(src).not.toContain('role="img"');
    expect(src).toContain('h-11');
  });

  it('IDs do /mais/alertas não colidem e os rótulos hardcoded em inglês sumiram', () => {
    expect(read('components/tostao-auto-card.tsx')).toContain('id="tostao-auto"');
    expect(read('components/avisos.tsx')).toContain('id="notificacoes-push"');
    expect(sources.filter((f) => read(f).includes('id="avisos"'))).toEqual([]);
    expect(sources.filter((f) => /alt="done"|aria-label="todo"/.test(read(f)))).toEqual([]);
  });

  it('todo role="img" tem aria-label (ou aria-labelledby) por perto', () => {
    const bad: string[] = [];
    for (const file of sources.filter((f) => f.endsWith('.tsx'))) {
      const lines = read(file).split('\n');
      lines.forEach((line, i) => {
        if (!line.includes('role="img"')) return;
        const ctx = lines.slice(Math.max(0, i - 4), i + 5).join('\n');
        if (!/aria-label/.test(ctx)) bad.push(`${file}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});

describe('T2.4 · redirect de quem já está logado', () => {
  it('/entrar e /criar-conta chamam redirectIfAuthenticated antes de renderizar', () => {
    for (const file of ['app/(auth)/entrar/page.tsx', 'app/(auth)/criar-conta/page.tsx']) {
      expect(read(file), file).toContain('await redirectIfAuthenticated()');
    }
  });
});

describe('Fase 4 preservada (a T2.4 não pode desfazer a T4.x)', () => {
  it('player: Voltar, dilema e gancho com os números da pessoa continuam lá', () => {
    const src = read('app/(app)/aprender/[licao]/player.tsx');
    for (const marker of ['canGoBack', 'previousStep', 'dilemmaLead', 'dilemmaOptions', 'personalizeHook']) {
      expect(src, marker).toContain(marker);
    }
  });

  it('landing: vitrine, planos e FAQ continuam lá', () => {
    const landing = read('app/(site)/landing.tsx');
    expect(landing).toContain('LandingVitrine');
    expect(landing).toMatch(/Planos|plans/i);
    expect(landing).toMatch(/Perguntas|faq/i);
  });

  it('toast global e Home de primeiros passos seguem plugados no layout do app', () => {
    const layout = read('app/(app)/layout.tsx');
    expect(layout).toContain('ToastProvider');
    expect(layout).toContain('FlashToastBridge');
    expect(layout).toContain('OnboardingShell');
  });
});

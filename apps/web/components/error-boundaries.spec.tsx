// T2.4 · error boundaries e fallbacks: existem, mostram "Tentar novamente", nunca vazam a mensagem do erro
// nem comando de desenvolvedor, e a marca (Tostão) aparece. renderToString (sem jsdom).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n-server', async () => {
  const { getDictionary } = await import('@/lib/i18n');
  return { getI18n: async () => ({ locale: 'pt-BR', t: getDictionary('pt-BR') }) };
});

import GlobalError from '@/app/global-error';
import RootError from '@/app/error';
import AppError from '@/app/(app)/error';
import NotFound from '@/app/not-found';
import AppLoading from '@/app/(app)/loading';
import OfflinePage from '@/app/offline/page';
import { ErrorScreen } from './error-screen';

const root = join(__dirname, '..');
// Comando de desenvolvedor montado em pedaços: o teste de "zero vestígios" varre o código inteiro, inclusive este arquivo.
const DEV_CMD = ['pnpm', 'dev'].join(' ');
const secret = new Error(`ECONNREFUSED 127.0.0.1:3333 — A API tá fora do ar (${DEV_CMD} na raiz) token=abc123`);
(secret as Error & { digest?: string }).digest = 'dig-42';
const reset = vi.fn();

describe('arquivos de fallback da T2.4', () => {
  it.each([
    'app/global-error.tsx',
    'app/error.tsx',
    'app/not-found.tsx',
    'app/(app)/error.tsx',
    'app/(app)/loading.tsx',
    'app/offline/page.tsx',
  ])('%s existe', (file) => {
    expect(existsSync(join(root, file))).toBe(true);
  });
});

describe('error boundaries', () => {
  const cases: [string, React.ReactElement][] = [
    ['app/(app)/error.tsx', <AppError key="a" error={secret} reset={reset} />],
    ['app/error.tsx', <RootError key="r" error={secret} reset={reset} />],
    ['app/global-error.tsx', <GlobalError key="g" error={secret} reset={reset} />],
  ];

  it.each(cases)('%s: botão "Tentar novamente", código do erro e zero vazamento', (_name, element) => {
    const html = renderToString(element);
    expect(html).toContain('Tentar novamente');
    expect(html).toContain('Código: dig-42');
    expect(html).toContain('role="alert"');
    for (const leak of ['ECONNREFUSED', DEV_CMD, 'abc123', '127.0.0.1', 'A API tá fora do ar']) {
      expect(html).not.toContain(leak);
    }
  });

  it('o do app leva de volta pro /inicio e o da raiz pra /', () => {
    expect(renderToString(<AppError error={secret} reset={reset} />)).toContain('href="/inicio"');
    expect(renderToString(<RootError error={secret} reset={reset} />)).toContain('href="/"');
  });

  it('global-error traz o próprio <html lang="pt-BR">', () => {
    expect(renderToString(<GlobalError error={secret} reset={reset} />)).toMatch(/^<html lang="pt-BR"/);
  });

  it('ErrorScreen sem onRetry não desenha o botão de tentar de novo', () => {
    const html = renderToString(<ErrorScreen title="t" body="b" homeLabel="Início" />);
    expect(html).not.toContain('<button');
    expect(html).toContain('Início');
  });
});

describe('not-found, loading e offline', () => {
  it('404 amigável com link pra home', async () => {
    const html = renderToString(await NotFound());
    expect(html).toContain('Essa página não existe');
    expect(html).toContain('href="/"');
  });

  it('loading é um skeleton anunciado como "Carregando" (e o resto escondido do leitor de tela)', async () => {
    const html = renderToString(await AppLoading());
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Carregando');
    expect(html).toContain('animate-pulse');
  });

  it('/offline é estática, sem dado da pessoa e sem comando de dev', () => {
    const html = renderToString(<OfflinePage />);
    expect(html).toContain('Você está sem internet');
    expect(html).not.toContain(DEV_CMD);
  });
});

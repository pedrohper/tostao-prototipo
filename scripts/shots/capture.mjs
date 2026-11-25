// A parte do `pnpm shots` que abre o navegador. Roda na máquina ou dentro da imagem oficial do Playwright (quem
// decide é o scripts/shots.mjs, que também sobe a API, a web e o usuário de demonstração). Só fala com localhost.
// Não compara imagens: salva os prints e um relatorio.json com o que parece quebrado (404, erro, rolagem lateral).
/* global document, window, setTimeout */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const SCREENS = [
  { name: 'inicio', path: '/inicio' },
  { name: 'carteira', path: '/carteira' },
  { name: 'anotar', path: '/anotar' },
  { name: 'tostao', path: '/tostao' },
  { name: 'aprender', path: '/aprender' },
  { name: 'simulador-balanco-do-estagio', path: '/aprender/simuladores/m5-l3' },
  { name: 'simulador-hora-de-freela', path: '/aprender/simuladores/m5-l4' },
  { name: 'simulador-bola-de-neve', path: '/aprender/simuladores/m2-l2' },
  { name: 'conectar', path: '/conectar' },
  { name: 'mais', path: '/mais' },
];
const VIEWPORTS = [
  { id: '390x844', width: 390, height: 844, isMobile: true, hasTouch: true },
  { id: '1440x900', width: 1440, height: 900, isMobile: false, hasTouch: false },
];
const THEMES = [
  { id: 'claro', cookie: 'light', colorScheme: 'light' },
  { id: 'escuro', cookie: 'dark', colorScheme: 'dark' },
];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const MAX_HEIGHT = 10_000;

/**
 * SHOTS_ONLY aceita nomes da lista ("inicio,mais") e também caminhos soltos ("/acertos,/fechamento"), pra conferir
 * uma tela que não está no conjunto padrão sem mexer no script.
 */
function pickScreens(only) {
  const wanted = only
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!wanted.length) return SCREENS;
  return wanted.map((item) => {
    if (item.startsWith('/')) return { name: item.slice(1).replace(/[^a-z0-9]+/gi, '-') || 'raiz', path: item };
    const screen = SCREENS.find((s) => s.name === item);
    if (!screen) throw new Error(`SHOTS_ONLY: não conheço a tela "${item}" (${SCREENS.map((s) => s.name).join(', ')})`);
    return screen;
  });
}

async function newContext(browser, base, viewport, theme, storageState) {
  const context = await browser.newContext({
    baseURL: base,
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    colorScheme: theme.colorScheme,
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'block',
    storageState,
  });
  // Nada sai da máquina: qualquer pedido pra fora (logo de banco, widget, fonte) é cortado.
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.protocol.startsWith('http') && !LOCAL_HOSTS.has(url.hostname) ? route.abort() : route.continue();
  });
  await context.addCookies([{ name: 'tostao-tema', value: theme.cookie, url: base }]);
  return context;
}

async function login(browser, base, email, password) {
  const context = await newContext(browser, base, VIEWPORTS[1], THEMES[0]);
  const page = await context.newPage();
  await page.goto('/entrar', { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL('**/inicio', { timeout: 60_000 }), page.click('button[type="submit"]')]);
  const state = await context.storageState();
  await context.close();
  // O cookie do tema é de cada contexto: tira o do login pra não sobrescrever o de cada captura.
  return { ...state, cookies: state.cookies.filter((c) => c.name !== 'tostao-tema') };
}

/** Espera a tela assentar: pedidos, blocos em <Suspense>, fontes e imagens (inclusive as que só carregam na rolagem). */
async function settle(page, warnings) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => warnings.push('rede não sossegou'));
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"], .animate-pulse'), null, { timeout: 15_000 })
    .catch(() => warnings.push('ainda tinha esqueleto de carregamento na tela'));
  await page.evaluate(async () => {
    const pause = () => new Promise((done) => setTimeout(done, 60));
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await pause();
    }
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
  // Só as imagens desenhadas: as que estão escondidas neste tamanho (ex.: coluna do computador) nem começam a carregar.
  await page
    .waitForFunction(
      () => [...document.images].every((img) => img.complete || img.getClientRects().length === 0),
      null,
      { timeout: 10_000 },
    )
    .catch(() => warnings.push('imagem sem terminar de carregar'));
  await page.waitForTimeout(400);
}

/**
 * Dois prints por tela: a primeira dobra, do tamanho exato do aparelho (é onde se vê o botão flutuante tampando algo), e
 * a página inteira. Pra inteira, a janela é esticada até a altura do conteúdo: com `fullPage` do Playwright, a barra de
 * baixo e o botão fixos apareceriam no meio da imagem, por cima do conteúdo.
 */
async function screenshot(page, viewport, height, outDir, name) {
  await page.screenshot({ path: join(outDir, 'dobra', name), animations: 'disabled' });
  if (height > viewport.height) {
    await page.setViewportSize({ width: viewport.width, height: Math.min(height, MAX_HEIGHT) });
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: join(outDir, name), animations: 'disabled' });
}

async function capture(context, screen, viewport, outDir, name) {
  const page = await context.newPage();
  const warnings = [];
  const problems = [];
  page.on('pageerror', (err) => problems.push(`erro de JavaScript: ${err.message}`));
  try {
    const response = await page.goto(screen.path, { waitUntil: 'load', timeout: 90_000 });
    await settle(page, warnings);
    const status = response?.status() ?? 0;
    if (status >= 400) problems.push(`HTTP ${status}`);
    const landed = new URL(page.url()).pathname;
    if (landed !== screen.path.split('?')[0]) problems.push(`foi parar em ${landed}`);
    const errorTitle = await page.evaluate(() => document.querySelector('main[role="alert"] h1')?.textContent ?? null);
    if (errorTitle) problems.push(`tela de erro: ${errorTitle}`);
    const layout = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const overflow = document.documentElement.scrollWidth - width;
      const culprits =
        overflow > 1
          ? [...document.querySelectorAll('body *')]
              .filter((el) => el.getBoundingClientRect().right > width + 1)
              .slice(0, 5)
              .map((el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').slice(0, 80)}`)
          : [];
      return { overflow, culprits, height: document.documentElement.scrollHeight };
    });
    if (layout.overflow > 1)
      warnings.push(`rolagem lateral de ${layout.overflow}px (${layout.culprits.join(' | ') || 'sem culpado óbvio'})`);
    await screenshot(page, viewport, layout.height, outDir, name);
    return { status, height: layout.height, warnings, problems };
  } catch (err) {
    problems.push(err.message.split('\n')[0]);
    await page.screenshot({ path: join(outDir, name) }).catch(() => {});
    return { status: 0, height: 0, warnings, problems };
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch();
  if (process.argv.includes('--probe')) {
    await browser.close();
    return 0;
  }
  const { SHOTS_BASE_URL: base, SHOTS_OUT: out, SHOTS_DEMO_EMAIL: email, SHOTS_DEMO_PASSWORD: password } = process.env;
  if (!base || !out || !email || !password) throw new Error('capture.mjs é chamado pelo scripts/shots.mjs');
  if (!LOCAL_HOSTS.has(new URL(base).hostname)) throw new Error('SHOTS_BASE_URL precisa ser local');
  mkdirSync(join(out, 'dobra'), { recursive: true });
  const screens = pickScreens(process.env.SHOTS_ONLY ?? '');
  const report = [];
  try {
    const session = await login(browser, base, email, password);
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        const context = await newContext(browser, base, viewport, theme, session);
        for (const screen of screens) {
          const name = `${screen.name}--${viewport.id}--${theme.id}.png`;
          const result = await capture(context, screen, viewport, out, name);
          report.push({ file: name, path: screen.path, viewport: viewport.id, theme: theme.id, ...result });
          const notes = [...result.problems.map((p) => `❌ ${p}`), ...result.warnings.map((w) => `⚠️  ${w}`)];
          console.log(`${result.problems.length ? '❌' : '📸'} ${name}${notes.length ? `  ${notes.join('  ')}` : ''}`);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
    if (report.length) writeFileSync(join(out, 'relatorio.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  const broken = report.filter((r) => r.problems.length).length;
  const warned = report.filter((r) => r.warnings.length).length;
  console.log(`\n${report.length} prints em ${out}: ${broken} com problema, ${warned} com aviso (ver relatorio.json).`);
  return broken ? 2 : 0;
}

process.exitCode = await main().catch((err) => {
  console.error(`❌ ${err.message}`);
  return 1;
});

// Home mobile mais limpa + categorias extras + Salvar fixo no rodapé: guardas lendo o código-fonte (sem navegador).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatIcon, ICON_SVGS } from '../components/icone';

const root = join(__dirname, '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

describe('Home mobile (inicio/page.tsx)', () => {
  const page = read('app/(app)/inicio/page.tsx');
  // Bloco que só aparece no mobile (lg:hidden) com o cartão de saldo: o que sobrou dele.
  const mobileBlock = page.slice(page.indexOf('<div className="flex flex-col gap-3 lg:hidden">'));

  it('sem a saudação "Fala, <nome>" (nem a variável que só servia a ela)', () => {
    expect(page).not.toContain('t.home.greeting(');
    expect(page).not.toContain('firstName');
  });

  it('mantém seletor de mês e ofensiva no cabeçalho sem a pílula de status do mês e coloca o olho ao lado do saldo mobile', () => {
    const header = page.slice(
      page.indexOf('<header className="flex items-center justify-between'),
      page.indexOf('</header>'),
    );
    const balanceCard = read('app/(app)/inicio/balance-card.tsx');
    expect(header).toContain('{monthSelector}');
    expect(header).toContain('<StreakModalButton');
    expect(page).not.toContain('t.home.monthInGreen');
    expect(page).not.toContain('monthStatus');
    expect(balanceCard).toContain('flex-col items-center gap-2 text-center');
    expect(balanceCard).toContain('flex items-center justify-center gap-1.5');
    expect(balanceCard).not.toContain('absolute -top-1 -right-1');
  });

  it('carrossel PlanejarAtalhos inclui anotar, anotações e importar sem prefetch agressivo', () => {
    const carousel = read('app/(app)/inicio/planejar-atalhos.tsx');
    expect(carousel).toContain('/anotar');
    expect(carousel).toContain('/anotacoes');
    expect(carousel).toContain('/importar');
    expect(carousel).toContain('prefetch={false}');
  });

  it('o Tostão compacto saiu da Home mobile e continua no desktop', () => {
    expect(mobileBlock.slice(0, 400)).not.toContain('AskTostaoCard');
    expect(page).not.toContain('<AskTostaoCard locale={locale} compact />');
    expect(page).toContain('<AskTostaoCard locale={locale} />'); // desktop (2 colunas)
  });

  it('anotar vira botão flutuante (fab) sem "+" duplicado e aparece na Carteira e em Anotações', () => {
    expect(page).toContain('<QuickAddButton variant="fab" label={t.nav.addExpense}');
    expect(page).not.toContain('<QuickAddButton variant="inline"');
    const carteira = read('app/(app)/carteira/page.tsx');
    expect(carteira).toContain('<QuickAddButton variant="fab" label={t.nav.addExpense}');
    expect(carteira).not.toContain("aba === 'extrato' && <QuickAddButton");
    const anotacoes = read('app/(app)/anotacoes/page.tsx');
    expect(anotacoes).toContain('<QuickAddButton variant="fab" label={t.nav.addExpense}');
  });
});

describe('QuickAddButton fab', () => {
  const sheet = read('components/quick-add-sheet.tsx');
  const css = read('app/globals.css');
  const fab = sheet.slice(sheet.indexOf("variant === 'fab'"), sheet.indexOf(": 'flex h-11"));
  it('laranja (bg-laranja text-tinta-fixa), portalizado no body e sem transform retido em .tela', () => {
    expect(sheet).toContain("label.replace(/^\\+\\s*/, '')");
    expect(sheet).toContain('createPortal(btn, document.body)');
    expect(sheet).toContain('createPortal(dialog, document.body)');
    expect(css).toContain('animation: sobe 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;');
    expect(fab).toContain('bg-laranja');
    expect(fab).toContain('text-tinta-fixa');
    expect(fab).toContain('fixed');
    expect(fab).toContain('bottom-[calc(86px+env(safe-area-inset-bottom))]');
    expect(fab).toContain('lg:hidden');
  });
});

describe('Metas, Anotações e Acertos no mobile', () => {
  it('Metas separa a lista geral (/meta) da tela individual (/meta?id=...) com edição e exclusão na tela da meta', () => {
    const meta = read('app/(app)/meta/page.tsx');
    expect(meta).toContain('if (!selected)');
    expect(meta).toContain('openGoalLabel');
    expect(meta).toContain('<GoalForm');
    expect(meta).toContain('<ConfirmSubmitButton');
  });

  it('Anotações permite navegar por mês (prevMes/nextMes) e ver todos os meses', () => {
    const anotacoes = read('app/(app)/anotacoes/page.tsx');
    expect(anotacoes).toContain('prevMes');
    expect(anotacoes).toContain('nextMes');
    expect(anotacoes).toContain("sp.mes === 'todos'");
  });

  it('Acertos usa botão "+ Criar acerto" (NewSplitButton) e esconde o formulário fixo no mobile (hidden ... lg:flex)', () => {
    const acertos = read('app/(app)/acertos/page.tsx');
    const pessoa = read('app/(app)/acertos/[id]/page.tsx');
    expect(acertos).toContain('<NewSplitButton');
    expect(acertos).toContain('hidden min-w-0 flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-4 lg:flex');
    expect(pessoa).toContain('<NewSplitButton');
    expect(pessoa).toContain('hidden min-w-0 flex-col gap-4 lg:flex');
  });
});

describe('Salvar no rodapé da folha (Android)', () => {
  it('SwipeSheet: altura dinâmica (dvh) e corpo com respiro da barra do sistema', () => {
    const swipe = read('components/sheet-swipe.tsx');
    expect(swipe).toContain('h-dvh');
    expect(swipe).toContain('pb-[max(1.75rem,env(safe-area-inset-bottom))]');
  });

  it('CategorizeForm: rodapé sticky com safe-area e o botão Salvar dentro dele', () => {
    const form = read('app/(app)/carteira/[id]/categorize-form.tsx');
    const footer = form.slice(form.indexOf('sticky bottom-0'));
    expect(footer).toContain('pb-[max(1rem,env(safe-area-inset-bottom))]');
    expect(footer.indexOf('type="submit"')).toBeGreaterThan(0);
    expect(form).toContain('<CategoryPicker');
  });
});

describe('Seletor reutilizado nos 3 lugares', () => {
  it('Carteira (detalhe), Anotar (unificado com QuickAddSheet) e modo categorizar usam o CategoryPicker', () => {
    expect(read('app/(app)/carteira/[id]/categorize-form.tsx')).toContain('CategoryPicker');
    expect(read('app/(app)/carteira/categorize-queue.tsx')).toContain('CategoryPicker');
    expect(read('components/quick-add-fields.tsx')).toContain('CategoryPicker');
    expect(read('components/quick-add-sheet.tsx')).toContain('<AnotarForm');
    expect(read('app/(app)/anotar/anotar-form.tsx')).toContain('CategoryField');
    expect(read('app/(app)/anotar/anotar-form.tsx')).toContain('+ Novo acerto');
    expect(read('app/(app)/carteira/[id]/acerto-picker.tsx')).toContain('+ {newLabel}');
  });
});

describe('ícones das categorias padrão', () => {
  // Os ids vêm do arquivo da API (fonte única das categorias do sistema).
  const defaults = readFileSync(join(root, '../api/src/lib/defaults.ts'), 'utf8');
  const ids = [...defaults.matchAll(/\{ id: '([a-z-]+)', name:/g)].map((m) => m[1]!);
  const overrides = JSON.parse(read('lib/icon-overrides.json')) as Record<string, string>;
  const novos = [
    'pets',
    'beleza',
    'viagem',
    'presentes',
    'taxas',
    'dividas',
    'investimentos',
    'freela',
    'reembolso',
    'rendimentos',
  ];

  it('achou as categorias padrão no arquivo da API', () => {
    expect(ids.length).toBeGreaterThanOrEqual(26);
    for (const id of novos) expect(ids).toContain(id);
  });

  it('toda categoria padrão tem ilustração (override) ou SVG vetorial em ICON_SVGS', () => {
    for (const id of ids) expect(overrides[`cat/${id}`] ?? ICON_SVGS[`cat/${id}`], id).toBeTruthy();
  });

  it('as novas desenham um ícone (svg), não o emoji de reserva', () => {
    for (const id of novos) {
      const html = renderToString(CatIcon({ id, emoji: '🏷️', size: 20 }) as React.ReactElement);
      expect(html, id).toContain('<svg');
      expect(html, id).toContain('stroke="currentColor"');
    }
  });
});

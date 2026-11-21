// T4.5 · cartões do chat e confirmação de lançamento. renderToString = markup (sem jsdom).
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ChatCardDTO, PendingActionDTO } from '@tostao/contracts';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { ChatCards, ProposalCard, dayMonthYear, monthYearLabel } from './chat-cards';

const NBSP = /\u00a0/g;
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(NBSP, ' ')
    .replace(/\s+/g, ' ');

const categoria: ChatCardDTO = {
  kind: 'categoria',
  categoryId: 'delivery',
  categoryName: 'Delivery',
  month: '2026-11',
  totalInCents: 31_240,
  count: 7,
  href: '/carteira?mes=2026-11&cat=delivery#lista',
};
const limite: ChatCardDTO = {
  kind: 'limite',
  categoryId: 'lazer',
  categoryName: 'Lazer',
  month: '2026-11',
  limitInCents: 20_000,
  spentInCents: 25_000,
  percentUsed: 125,
  href: '/limites',
};
const meta: ChatCardDTO = {
  kind: 'meta',
  label: 'Praia',
  amountInCents: 300_000,
  savedInCents: 60_000,
  deadline: '2027-07',
  monthlyNeededInCents: 30_000,
  fits: false,
  reached: false,
  href: '/meta',
};

describe('ChatCards', () => {
  it('sem cartões não renderiza nada', () => {
    expect(renderToString(<ChatCards cards={[]} />)).toBe('');
  });

  it('categoria: nome, mês, total em reais, quantidade e link pra Carteira filtrada', () => {
    const html = renderToString(<ChatCards cards={[categoria]} />);
    const t = text(html);
    expect(t).toContain('Delivery em novembro');
    expect(t).toContain('R$ 312,40');
    expect(t).toContain('7 lançamentos');
    expect(html).toContain('href="/carteira?mes=2026-11&amp;cat=delivery#lista"');
  });

  it('limite estourado mostra a barra, quanto passou e o link; dentro do limite não mostra "passou"', () => {
    const over = renderToString(<ChatCards cards={[limite]} />);
    expect(over).toContain('role="progressbar"');
    expect(text(over)).toContain('R$ 250,00 de R$ 200,00');
    expect(text(over)).toContain('Passou R$ 50,00');
    expect(over).toContain('href="/limites"');
    const ok = renderToString(
      <ChatCards cards={[{ ...limite, spentInCents: 5_000, percentUsed: 25 } as ChatCardDTO]} />,
    );
    expect(text(ok)).not.toContain('Passou');
  });

  it('meta: guardado de total, prazo, quanto guardar por mês e se cabe', () => {
    const t = text(renderToString(<ChatCards cards={[meta]} />));
    expect(t).toContain('Sua meta: Praia');
    expect(t).toContain('R$ 600,00 de R$ 3.000,00');
    expect(t).toContain('Até julho/2027');
    expect(t).toContain('Guardar R$ 300,00 por mês');
    expect(t).toContain('Não cabe no que sobra');
  });

  it('meta atingida: comemora e não pede mais pra guardar', () => {
    const t = text(
      renderToString(<ChatCards cards={[{ ...meta, reached: true, savedInCents: 300_000 } as ChatCardDTO]} />),
    );
    expect(t).toContain('Meta atingida!');
    expect(t).not.toContain('Guardar R$');
  });

  it('link vindo estranho do servidor nunca vira externo ou protocolo-relativo', () => {
    for (const href of ['https://malicioso.test', '//malicioso.test', 'javascript:alert(1)']) {
      const html = renderToString(<ChatCards cards={[{ ...categoria, href } as ChatCardDTO]} />);
      expect(html).not.toContain('malicioso');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('href="/"');
    }
  });

  it('o texto do cartão é escapado (nome de categoria com HTML não vira marcação)', () => {
    const html = renderToString(
      <ChatCards cards={[{ ...categoria, categoryName: '<img src=x onerror=alert(1)>' } as ChatCardDTO]} />,
    );
    expect(html).not.toContain('<img');
  });
});

describe('ProposalCard (confirmação antes de gravar)', () => {
  const proposal: PendingActionDTO = {
    id: 'abc12345',
    kind: 'registrar_transacao',
    summary: 'Gasto de R$ 64,50: Pizza',
    description: 'Pizza',
    amountInCents: 6_450,
    type: 'saida',
    categoryName: 'Delivery',
    date: '2026-11-19',
    expiresAt: '2026-11-21T12:05:00.000Z',
  };
  const render = (p: PendingActionDTO) =>
    renderToString(<ProposalCard proposal={p} onConfirm={() => {}} onCancel={() => {}} />);

  it('mostra Valor, Descrição, Categoria e Data em campos separados, mais o aviso de que nada foi anotado', () => {
    const t = text(render(proposal));
    expect(t).toContain('Valor −R$ 64,50');
    expect(t).toContain('Descrição Pizza');
    expect(t).toContain('Categoria Delivery');
    expect(t).toContain('Data 19/11/2026');
    expect(t).toContain('Gasto');
    expect(t).toContain('Nada foi anotado ainda');
    expect(t).toContain('Confirmar');
    expect(t).toContain('Cancelar');
  });

  it('entrada vem com +; sem categoria avisa que as regras decidem', () => {
    const t = text(render({ ...proposal, type: 'entrada', categoryName: null }));
    expect(t).toContain('Valor +R$ 64,50');
    expect(t).toContain('Categoria Automática (pelas regras)');
    expect(t).toContain('Entrada');
  });

  it('enquanto confirma, os dois botões ficam desabilitados (nenhum duplo clique)', () => {
    const html = renderToString(<ProposalCard proposal={proposal} onConfirm={() => {}} onCancel={() => {}} busy />);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it('descrição com HTML é escapada', () => {
    expect(render({ ...proposal, description: '<script>x</script>' })).not.toContain('<script>');
  });
});

describe('formatos', () => {
  it('data sem passar por Date (sem erro de fuso) e mês/ano do prazo', () => {
    expect(dayMonthYear('2026-01-05')).toBe('05/01/2026');
    expect(dayMonthYear('lixo')).toBe('lixo');
    expect(monthYearLabel('2027-07', 'pt-BR')).toBe('julho/2027');
  });
});

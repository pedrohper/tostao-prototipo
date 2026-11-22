// Seletor de categorias (estilo Mobills): markup da lista, busca (>10), alvos de 44px, mini-form de "+ Criar categoria".
// Sem jsdom (convenção do projeto): o fluxo de criar e o Enter estão em lib/category-picker.spec.ts.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryDTO } from '@tostao/contracts';

// O componente importa a Server Action como padrão; aqui ela não roda (e puxaria next/headers).
vi.mock('@/app/(app)/categorias/actions', () => ({ createCategoryInline: vi.fn() }));

import { CategoryPicker } from './category-picker';

const noop = () => {};
const cat = (id: string, kind: CategoryDTO['kind'] = 'saida', name = id): CategoryDTO => ({
  id,
  name,
  emoji: '🏷️',
  color: '#DCEBFF',
  kind,
  custom: false,
});
const many = (n: number) => Array.from({ length: n }, (_, i) => cat(`cat-${i}`));

describe('CategoryPicker', () => {
  it('lista rolável: max-h 42dvh, overscroll-contain, ícone + nome + marca; cada linha tem ao menos 48px', () => {
    const html = renderToString(
      <CategoryPicker
        categories={[cat('mercado'), cat('pets')]}
        kind="saida"
        value="pets"
        onChange={noop}
        label="Categoria"
      />,
    );
    expect(html).toContain('max-h-[42dvh]');
    expect(html).toContain('overflow-y-auto');
    expect(html).toContain('overscroll-contain');
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/min-h-12/g)?.length).toBeGreaterThanOrEqual(2); // 48px ≥ 44px
    expect(html).toMatch(/background-color:#DCEBFF/i); // selo com a cor da categoria
    expect(html).toMatch(/aria-checked="true"[^>]*data-cat-id="pets"/);
    expect(html).toMatch(/aria-checked="false"[^>]*data-cat-id="mercado"/);
  });

  it('busca só aparece com mais de 10 categorias', () => {
    const poucas = renderToString(
      <CategoryPicker categories={many(10)} kind="saida" value={null} onChange={noop} label="Categoria" />,
    );
    expect(poucas).not.toContain('type="search"');
    const muitas = renderToString(
      <CategoryPicker categories={many(11)} kind="saida" value={null} onChange={noop} label="Categoria" />,
    );
    expect(muitas).toContain('type="search"');
  });

  it('só mostra o tipo certo; "Não conta" só com includeNeutral', () => {
    const lista = [cat('delivery'), cat('salario', 'entrada'), cat('nao-conta', 'neutra')];
    const saida = renderToString(
      <CategoryPicker categories={lista} kind="saida" value={null} onChange={noop} label="Categoria" />,
    );
    expect(saida).toContain('data-cat-id="delivery"');
    expect(saida).not.toContain('data-cat-id="salario"');
    expect(saida).not.toContain('data-cat-id="nao-conta"');
    const comNeutra = renderToString(
      <CategoryPicker categories={lista} kind="saida" value={null} onChange={noop} label="Categoria" includeNeutral />,
    );
    expect(comNeutra).toContain('data-cat-id="nao-conta"');
  });

  it('com `name`, leva o id escolhido num campo oculto; sem escolha, vazio', () => {
    const com = renderToString(
      <CategoryPicker categories={many(2)} kind="saida" value="cat-1" onChange={noop} label="C" name="categoryId" />,
    );
    expect(com).toContain('type="hidden" name="categoryId" value="cat-1"');
    const sem = renderToString(
      <CategoryPicker categories={many(2)} kind="saida" value={null} onChange={noop} label="C" name="categoryId" />,
    );
    expect(sem).toContain('name="categoryId" value=""');
  });

  it('tem o botão "+ Criar categoria" (e some o formulário enquanto fechado)', () => {
    const html = renderToString(
      <CategoryPicker categories={many(2)} kind="saida" value={null} onChange={noop} label="C" />,
    );
    expect(html).toContain('+ Criar categoria');
    expect(html).not.toContain('Nova categoria');
  });

  it('mini-form aberto: nome, tipo, 6 cores de 44px e botões; nada de <form> aninhado nem botão que envia', () => {
    const html = renderToString(
      <CategoryPicker categories={many(2)} kind="entrada" value={null} onChange={noop} label="C" defaultOpen />,
    );
    expect(html).toContain('Nova categoria');
    expect(html).toContain('maxLength="30"');
    expect(html).toContain('Criar e usar');
    expect(html.match(/h-11 w-11/g)).toHaveLength(6); // swatches de 44px
    expect(html).toContain('aria-label="Menta"');
    expect(html).not.toContain('<form'); // aninhar <form> dentro do <form> de Salvar quebraria o envio
    expect(html).not.toContain('type="submit"'); // nenhum botão daqui envia o formulário de fora
    // "Entrada" já vem marcada porque a lista é de entradas
    expect(html).toMatch(/aria-checked="true"[^>]*>Entrada</);
  });
});

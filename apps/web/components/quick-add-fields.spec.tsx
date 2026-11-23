// T4.4 · campos do "Anotar rápido": máscara visível, chips Hoje/Ontem, categorias com ícone, nota recolhida.
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CategoryDTO } from '@tostao/contracts';
import { AmountInput, CategoryField, DateChips, DescriptionInput, NoteField } from './quick-add-fields';

const noop = () => {};
const cat = (id: string, kind: CategoryDTO['kind'] = 'saida'): CategoryDTO => ({
  id,
  name: id,
  emoji: '🏷️',
  color: '#fff',
  kind,
  custom: false,
});

describe('AmountInput', () => {
  it('mostra o valor mascarado, teclado numérico e o placeholder 0,00', () => {
    const html = renderToString(<AmountInput value="1.234,56" onChange={noop} label="Quanto" />);
    expect(html).toContain('value="1.234,56"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('placeholder="0,00"');
    expect(html).toContain('name="amount"');
  });
});

describe('DateChips', () => {
  it('Hoje ativo quando a data é hoje; Ontem ativo no dia anterior; senão "Outra data"', () => {
    const hoje = renderToString(<DateChips value="2026-11-21" onChange={noop} today="2026-11-21" />);
    expect(hoje).toMatch(/aria-pressed="true"[^>]*>Hoje</);
    const ontem = renderToString(<DateChips value="2026-11-20" onChange={noop} today="2026-11-21" />);
    expect(ontem).toMatch(/aria-pressed="true"[^>]*>Ontem</);
    const outra = renderToString(<DateChips value="2026-11-01" onChange={noop} today="2026-11-21" />);
    expect(outra).toMatch(/aria-pressed="true"[^>]*>Outra data</);
  });

  it('o campo de data sempre existe (leva o valor no envio) mas só aparece em "Outra data"', () => {
    const hoje = renderToString(<DateChips value="2026-11-21" onChange={noop} today="2026-11-21" />);
    expect(hoje).toContain('name="occurredAt"');
    expect(hoje).toContain('value="2026-11-21"');
    const dateInputClass = (html: string) => /<input[^>]*type="date"[^>]*class="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(dateInputClass(hoje)).toContain('sr-only');
    const outra = renderToString(<DateChips value="2026-11-01" onChange={noop} today="2026-11-21" />);
    expect(dateInputClass(outra)).not.toContain('sr-only');
  });

  it('não bloqueia data futura (conta a vencer e parcelas continuam possíveis)', () => {
    expect(renderToString(<DateChips value="2026-11-21" onChange={noop} today="2026-11-21" />)).not.toContain('max=');
  });
});

describe('DescriptionInput', () => {
  it('sugere as últimas descrições; digitando, filtra', () => {
    const recents = ['Almoço', 'Uber', 'Mercado'];
    const vazio = renderToString(
      <DescriptionInput value="" onChange={noop} recents={recents} label="O que foi" placeholder="Ex." />,
    );
    for (const r of recents) expect(vazio).toContain(`>${r}<`);
    const filtrado = renderToString(
      <DescriptionInput value="ub" onChange={noop} recents={recents} label="O que foi" placeholder="Ex." />,
    );
    expect(filtrado).toContain('>Uber<');
    expect(filtrado).not.toContain('>Almoço<');
  });

  it('sem histórico, sem faixa de sugestões', () => {
    const html = renderToString(
      <DescriptionInput value="" onChange={noop} recents={[]} label="O que foi" placeholder="Ex." />,
    );
    expect(html).not.toContain('overflow-x-auto');
  });
});

describe('CategoryField', () => {
  const categories = ['delivery', 'comer-fora', 'mercado', 'transporte', 'extra-rara'].map((id) => cat(id));

  it('usa seleção suspensa por padrão e lista todas as categorias com ícone e "+ Criar categoria" ao abrir', () => {
    const fechado = renderToString(
      <CategoryField categories={categories} kind="saida" value={null} onChange={noop} legend="Categoria" />,
    );
    expect(fechado).toContain('aria-expanded="false"');
    expect(fechado).toContain('Escolher categoria');

    const aberto = renderToString(
      <CategoryField
        categories={categories}
        kind="saida"
        value={null}
        onChange={noop}
        legend="Categoria"
        variant="inline"
      />,
    );
    for (const id of ['delivery', 'comer-fora', 'mercado', 'transporte', 'extra-rara'])
      expect(aberto).toContain(`>${id}<`);
    expect(aberto).not.toContain('>Mais<');
    expect(aberto).toMatch(/<(svg|img|span)[^>]*aria-hidden="true"/); // CatIcon (ícone de cada categoria)
    expect(aberto).toContain('+ Criar categoria');
  });

  it('a escolhida vai no campo categoryId e aparece marcada', () => {
    const html = renderToString(
      <CategoryField
        categories={categories}
        kind="saida"
        value="mercado"
        onChange={noop}
        legend="Categoria"
        variant="inline"
      />,
    );
    expect(html).toContain('name="categoryId" value="mercado"');
    expect(html).toMatch(/aria-checked="true"[^>]*data-cat-id="mercado"/);
  });

  it('entrada só mostra categorias de entrada', () => {
    const html = renderToString(
      <CategoryField
        categories={[cat('salario', 'entrada'), cat('delivery')]}
        kind="entrada"
        value={null}
        onChange={noop}
        legend="Categoria"
        variant="inline"
      />,
    );
    expect(html).toContain('>salario<');
    expect(html).not.toContain('>delivery<');
  });
});

describe('NoteField', () => {
  it('recolhida: só o link "+ Adicionar nota" e um campo oculto vazio', () => {
    const html = renderToString(
      <NoteField value="" onChange={noop} open={false} onOpen={noop} addLabel="+ Adicionar nota" placeholder="Nota" />,
    );
    expect(html).toContain('+ Adicionar nota');
    expect(html).toContain('type="hidden" name="note" value=""');
  });

  it('aberta (ou com texto) mostra o campo', () => {
    const aberta = renderToString(
      <NoteField value="" onChange={noop} open onOpen={noop} addLabel="+ Adicionar nota" placeholder="Nota" />,
    );
    expect(aberta).toContain('placeholder="Nota"');
    const comTexto = renderToString(
      <NoteField
        value="lembrar"
        onChange={noop}
        open={false}
        onOpen={noop}
        addLabel="+ Adicionar nota"
        placeholder="Nota"
      />,
    );
    expect(comTexto).toContain('value="lembrar"');
  });
});

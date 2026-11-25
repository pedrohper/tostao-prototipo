// T6.14 · galeria que ensina antes: cada cartão diz o que a pessoa vai entender e a página do simulador traz o "Antes
// de mexer" (fechado) com o conceito da lição e o link, antes do simulador. renderToString das páginas de servidor.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('@/lib/i18n-server', async () => {
  const { getDictionary } = await import('@/lib/i18n');
  return { getI18n: async () => ({ locale: 'pt-BR', t: getDictionary('pt-BR') }) };
});
vi.mock('@/lib/lesson-context-server', () => ({ loadLessonContext: async () => null }));

import SimuladoresPage from '@/app/(app)/aprender/simuladores/page';
import SimuladorPage from '@/app/(app)/aprender/simuladores/[id]/page';
import { findLesson } from '@/lib/lessons';
import { SIMULATOR_CATALOG } from '@/lib/simulators-catalog';

/** Desfaz o escape do React, pra comparar com o texto do catálogo e do currículo. */
const solto = (html: string) =>
  html
    .replace(/<!-- -->/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const pagina = async (id: string) => solto(renderToString(await SimuladorPage({ params: Promise.resolve({ id }) })));

describe('galeria /aprender/simuladores', () => {
  it('cada cartão leva ao simulador e diz o que a pessoa vai entender', async () => {
    const html = solto(renderToString(await SimuladoresPage()));
    expect(html.match(/Você vai entender/g)).toHaveLength(SIMULATOR_CATALOG.length);
    for (const s of SIMULATOR_CATALOG) {
      expect(html, s.id).toContain(`href="/aprender/simuladores/${s.id}"`);
      expect(html, s.id).toContain(s.aprende);
    }
  });
});

describe('página /aprender/simuladores/[id]', () => {
  it('"Antes de mexer" fechado, com o conceito da lição e o link, antes do simulador', async () => {
    for (const s of SIMULATOR_CATALOG) {
      const html = await pagina(s.id);
      const bloco = html.match(/<details class="group rounded-\[20px\][\s\S]*?<\/details>/)?.[0];
      expect(bloco, s.id).toBeTruthy();
      expect(bloco, s.id).not.toMatch(/^<details[^>]*\sopen/);
      expect(bloco, s.id).toContain('Antes de mexer');
      expect(bloco, s.id).toContain(s.aprende);
      expect(bloco, s.id).toContain(findLesson(s.id)!.lesson.concept);
      expect(bloco, s.id).toMatch(new RegExp(`href="/aprender/${s.id}"[^>]*>Ver a lição completa<`));
      // o simulador vem depois do bloco
      const depois = html.slice(html.indexOf(bloco!) + bloco!.length);
      expect(depois, s.id).toMatch(/data-simulador-shell|<input|<button/);
    }
  });

  it('os 3 pilotos abrem pela galeria, no palpite', async () => {
    for (const id of ['m2-l2', 'm5-l3', 'm5-l4']) {
      const html = await pagina(id);
      expect(html, id).toContain('data-simulador-shell');
      expect(html, id).toContain('role="radiogroup"');
    }
  });

  it('id fora da galeria continua 404', async () => {
    await expect(pagina('m1-l4')).rejects.toThrow('NOT_FOUND');
  });
});

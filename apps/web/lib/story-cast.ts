import type { MascotPose } from '@/components/mascote';

export type CastCharacter = 'tostao' | 'caramelo' | 'tigrinho' | 'urubu' | 'dupla';

export interface StoryPageMeta {
  speaker: CastCharacter;
  poses: readonly [MascotPose] | readonly [MascotPose, MascotPose];
  slideKey?: string;
}

export interface BookThemeMeta {
  bgClass: string;
  spineColor: string;
  accentTextClass: string;
}

export const BOOK_THEMES: Record<number, BookThemeMeta> = {
  1: { bgClass: 'bg-amarelo-claro', spineColor: '#FFC233', accentTextClass: 'text-laranja-texto' },
  2: { bgClass: 'bg-rosa', spineColor: '#FF5A36', accentTextClass: 'text-vermelho-texto' },
  3: { bgClass: 'bg-laranja-claro', spineColor: '#E55A3B', accentTextClass: 'text-laranja-texto' },
  4: { bgClass: 'bg-menta-clara', spineColor: '#3DD6A0', accentTextClass: 'text-verde-texto' },
  5: { bgClass: 'bg-amarelo-claro', spineColor: '#F59E0B', accentTextClass: 'text-laranja-texto' },
  6: { bgClass: 'bg-azul', spineColor: '#5B8DEF', accentTextClass: 'text-tinta' },
  7: { bgClass: 'bg-menta-clara', spineColor: '#2BB686', accentTextClass: 'text-verde-texto' },
  8: { bgClass: 'bg-roxo-suave', spineColor: '#7C5CFC', accentTextClass: 'text-tinta' },
  9: { bgClass: 'bg-rosa', spineColor: '#D93848', accentTextClass: 'text-vermelho-texto' },
};

export const STORY_PAGE_META: Record<string, StoryPageMeta> = {
  // Livro 1 — Saindo da neblina
  'm1-l1': { speaker: 'caramelo', poses: ['caramelo-farejando', 'investigando'] },
  'm1-l2': { speaker: 'tostao', poses: ['professor', 'caramelo'], slideKey: 'slide-m1-l2-pizza' },
  'm1-l3': { speaker: 'dupla', poses: ['dupla'] },
  'm1-l4': { speaker: 'caramelo', poses: ['caramelo-acenando', 'preocupado'] },
  'm1-l5': { speaker: 'caramelo', poses: ['caramelo-farejando'] },

  // Livro 2 — Cartão sem armadilha
  'm2-l1': { speaker: 'tigrinho', poses: ['tigrinho', 'preocupado'] },
  'm2-l2': { speaker: 'tostao', poses: ['chocado', 'caramelo-bravo'], slideKey: 'slide-m2-l2-rotativo' },
  'm2-l3': { speaker: 'caramelo', poses: ['caramelo-moeda', 'pensando'] },
  'm2-l4': { speaker: 'urubu', poses: ['urubu-pix', 'caramelo-bravo'], slideKey: 'slide-m2-l4-pix-parcelado' },
  'm2-l5': { speaker: 'tostao', poses: ['orgulhoso', 'caramelo-feliz'], slideKey: 'slide-m2-l5-regua-fatura' },

  // Livro 3 — Batalha contra a dívida
  'm3-l1': { speaker: 'dupla', poses: ['preocupado', 'caramelo-bravo'] },
  'm3-l2': { speaker: 'tostao', poses: ['investigando', 'caramelo'], slideKey: 'slide-m3-l2-avalanche-bola' },
  'm3-l3': { speaker: 'urubu', poses: ['urubu', 'orgulhoso'] },
  'm3-l4': { speaker: 'caramelo', poses: ['caramelo-acenando', 'pensando'] },
  'm3-l5': { speaker: 'dupla', poses: ['dupla'], slideKey: 'slide-m3-l5-minimo-existencial' },

  // Livro 4 — Construindo o muro
  'm4-l1': { speaker: 'tostao', poses: ['professor', 'caramelo-moeda'], slideKey: 'slide-m4-l1-muro-clt-autonomo' },
  'm4-l2': { speaker: 'caramelo', poses: ['caramelo-farejando', 'pensando'] },
  'm4-l3': { speaker: 'tigrinho', poses: ['tigrinho', 'caramelo-bravo'] },
  'm4-l4': { speaker: 'dupla', poses: ['comemorando', 'caramelo-feliz'] },
  'm4-l5': { speaker: 'tostao', poses: ['orgulhoso', 'caramelo-dormindo'] },

  // Livro 5 — Investir em você
  'm5-l1': { speaker: 'tostao', poses: ['orgulhoso', 'caramelo-feliz'] },
  'm5-l2': { speaker: 'urubu', poses: ['urubu', 'caramelo-bravo'] },
  'm5-l3': { speaker: 'tostao', poses: ['pensando', 'caramelo'] },
  'm5-l4': { speaker: 'dupla', poses: ['conectando', 'caramelo-moeda'] },
  'm5-l5': { speaker: 'caramelo', poses: ['caramelo-moeda', 'comemorando'] },

  // Livro 6 — Primeiro salário
  'm6-l1': { speaker: 'tostao', poses: ['investigando', 'caramelo-farejando'], slideKey: 'slide-m6-l1-holerite' },
  'm6-l2': { speaker: 'caramelo', poses: ['caramelo-farejando', 'chocado'], slideKey: 'slide-m6-l2-saque-aniversario' },
  'm6-l3': { speaker: 'tigrinho', poses: ['tigrinho', 'orgulhoso'] },
  'm6-l4': { speaker: 'tostao', poses: ['acenando', 'caramelo-dormindo'] },
  'm6-l5': { speaker: 'dupla', poses: ['professor', 'caramelo'], slideKey: 'slide-m6-l5-clt-pj' },

  // Livro 7 — Abrindo o cofre
  'm7-l1': { speaker: 'tostao', poses: ['professor', 'caramelo-moeda'] },
  'm7-l2': { speaker: 'caramelo', poses: ['caramelo-feliz', 'orgulhoso'] },
  'm7-l3': { speaker: 'tostao', poses: ['pensando', 'caramelo'], slideKey: 'slide-m7-l3-tabela-ir' },
  'm7-l4': { speaker: 'dupla', poses: ['dupla'] },
  'm7-l5': { speaker: 'caramelo', poses: ['caramelo-bravo', 'chocado'], slideKey: 'slide-m7-l5-inflacao' },

  // Livro 8 — Bolsa sem hype
  'm8-l1': { speaker: 'tostao', poses: ['investigando', 'caramelo'] },
  'm8-l2': { speaker: 'caramelo', poses: ['caramelo-moeda', 'professor'] },
  'm8-l3': { speaker: 'dupla', poses: ['dupla'], slideKey: 'slide-m8-l3-etf-cesta' },
  'm8-l4': { speaker: 'tigrinho', poses: ['tigrinho', 'caramelo-bravo'] },
  'm8-l5': { speaker: 'tostao', poses: ['preocupado', 'caramelo'] },

  // Livro 9 — Defesa pessoal
  'm9-l1': { speaker: 'urubu', poses: ['urubu-pix', 'caramelo-bravo'] },
  'm9-l2': { speaker: 'tigrinho', poses: ['tigrinho', 'caramelo-bravo'], slideKey: 'slide-m9-l2-house-edge' },
  'm9-l3': { speaker: 'urubu', poses: ['urubu', 'preocupado'] },
  'm9-l4': { speaker: 'caramelo', poses: ['caramelo-farejando', 'urubu-fugindo'] },
  'm9-l5': { speaker: 'dupla', poses: ['comemorando', 'urubu-fugindo'] },
};

export function getStoryPageMeta(lessonId: string): StoryPageMeta {
  return STORY_PAGE_META[lessonId] ?? { speaker: 'tostao', poses: ['professor'] };
}

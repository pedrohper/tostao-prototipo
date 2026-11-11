// Conteúdo das lições vem de um JSON versionado no repo (content/lessons/modules.json).
// Gerado a partir do content/curriculo.md com: pnpm content:build
import data from '../../../content/lessons/modules.json';

export type Lesson = (typeof data.modules)[number]['lessons'][number];
export type Module = (typeof data.modules)[number];

export const modules: Module[] = data.modules;

export function findLesson(id: string) {
  for (const m of modules) {
    const lesson = m.lessons.find((l) => l.id === id);
    if (lesson) return { module: m, lesson };
  }
  return null;
}

// Cor de cada módulo na trilha (igual ao protótipo do canvas)
export const MODULE_COLORS = ['#FFC233', '#DCEBFF', '#FFE1E7', '#DDF6E8', '#FFF1C7', '#DCEBFF', '#DDF6E8', '#FFE1E7', '#F6EFE4'];

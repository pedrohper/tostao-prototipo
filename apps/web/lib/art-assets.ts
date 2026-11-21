// Artes de livros e slides. A lista vem de `art-manifest.json`, gerado NO BUILD por scripts/sync-art-manifest.mjs
// (`pnpm assets:sync`): em runtime não toca o disco (antes eram ~150 chamadas síncronas ao disco por visita ao /aprender,
// bloqueando o event loop do Node). Arte nova: rode `pnpm assets:sync` (o `prebuild` do web já roda).
import manifest from './art-manifest.json';

type Folder = keyof typeof manifest;

function findPublicAsset(folder: Folder, name: string): string | null {
  return (manifest[folder] as Record<string, string>)[name] ?? null;
}

export function getBookPageAssets(lessonIds: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const id of lessonIds) {
    const found = findPublicAsset('livros', id);
    if (found) map[id] = found;
  }
  return map;
}

export function getBookCoverAssets(moduleNumbers: number[]): Record<number, string> {
  const map: Record<number, string> = {};
  for (const num of moduleNumbers) {
    const found = findPublicAsset('livros', `capa-m${num}`);
    if (found) map[num] = found;
  }
  return map;
}

export function getSlideAsset(slideKey: string | undefined): string | null {
  if (!slideKey) return null;
  return findPublicAsset('slides', slideKey);
}

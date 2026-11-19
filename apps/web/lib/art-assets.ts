import { existsSync } from 'node:fs';
import path from 'node:path';

const PUBLIC_ROOT = path.join(process.cwd(), 'public');
const EXTS = ['webp', 'png', 'jpg', 'jpeg'] as const;

function findPublicAsset(folder: string, name: string): string | null {
  for (const ext of EXTS) {
    const rel = `/${folder}/${name}.${ext}`;
    if (existsSync(path.join(PUBLIC_ROOT, rel))) return rel;
  }
  return null;
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

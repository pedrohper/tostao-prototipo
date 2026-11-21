// T2.3 · arte de livros/slides vem do manifesto gerado no build: nada de tocar o disco por requisição.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import manifest from './art-manifest.json';
import { getBookCoverAssets, getBookPageAssets, getSlideAsset } from './art-assets';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

describe('art-assets em runtime', () => {
  it('não importa fs nem chama existsSync: lê só o JSON em memória', () => {
    const src = readFileSync(here('./art-assets.ts'), 'utf8');
    expect(src).not.toMatch(/existsSync/);
    expect(src).not.toMatch(/node:fs|from 'fs'|process\.cwd/);
    expect(src).toMatch(/art-manifest\.json/);
  });

  it('devolve a URL do manifesto: página, capa por módulo e slide; o que não existe vira null/ausente', () => {
    const [firstPage] = Object.keys(manifest.livros).filter((k) => /^m\d+-l\d+$/.test(k));
    expect(getBookPageAssets([firstPage!, 'm99-l99'])).toEqual({ [firstPage!]: manifest.livros[firstPage as never] });
    const cover = Object.keys(manifest.livros).find((k) => k.startsWith('capa-m'));
    if (cover) {
      const n = Number(cover.replace('capa-m', ''));
      expect(getBookCoverAssets([n, 999])).toEqual({ [n]: manifest.livros[cover as never] });
    }
    const [slide] = Object.keys(manifest.slides);
    expect(getSlideAsset(slide)).toBe(manifest.slides[slide as never]);
    expect(getSlideAsset('nao-existe')).toBeNull();
    expect(getSlideAsset(undefined)).toBeNull();
  });

  it('todo arquivo do manifesto existe em public/ e o manifesto cobre tudo que está lá (rode `pnpm assets:sync`)', () => {
    for (const folder of ['livros', 'slides'] as const) {
      const onDisk = readdirSync(here(`../public/${folder}`)).filter((f) => /\.(webp|png|jpe?g)$/i.test(f));
      const listed = Object.values(manifest[folder]).map((u) => u.split('/').pop()!);
      for (const url of listed) expect(onDisk, url).toContain(url);
      const names = new Set(onDisk.map((f) => f.replace(/\.[^.]+$/, '')));
      expect(new Set(Object.keys(manifest[folder]))).toEqual(names);
    }
  });

  it('regenerar o manifesto não muda nada (o JSON versionado é o do script)', () => {
    const before = readFileSync(here('./art-manifest.json'), 'utf8');
    execFileSync('node', [here('../../../scripts/sync-art-manifest.mjs')], { stdio: 'ignore' });
    expect(readFileSync(here('./art-manifest.json'), 'utf8')).toBe(before);
  });
});

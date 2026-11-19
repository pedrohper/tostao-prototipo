// Varre apps/web/public/icones/ atrás de artes rasterizadas (.webp / .png) para sobrepor os SVGs antigos.
// Rode `node scripts/sync-art-manifest.mjs` depois de adicionar novos ícones em public/icones/.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const iconesRoot = new URL('../apps/web/public/icones/', import.meta.url).pathname;
const outFile = new URL('../apps/web/lib/icon-overrides.json', import.meta.url);
const EXTS = ['.webp', '.png', '.jpg', '.jpeg'];

const overrides = {};

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    const rel = relative(iconesRoot, full).replace(/\\/g, '/');
    const match = /^(.*)\.(webp|png|jpe?g)$/i.exec(rel);
    if (!match) continue;
    const key = match[1];
    // Ignora os ícones PWA da raiz (icon-192, icon-512, icon-maskable-512)
    if (!key.includes('/')) continue;
    const ext = `.${match[2].toLowerCase()}`;
    const prev = overrides[key];
    if (!prev || EXTS.indexOf(ext) < EXTS.indexOf(prev.slice(prev.lastIndexOf('.')))) {
      overrides[key] = `/icones/${rel}`;
    }
  }
}

walk(iconesRoot);
writeFileSync(outFile, JSON.stringify(overrides, null, 2) + '\n');
console.log(`${Object.keys(overrides).length} ícones customizados registrados.`);

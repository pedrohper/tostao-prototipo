// Varre apps/web/public/ atrás de artes rasterizadas (.webp / .png / .jpg) e gera dois manifestos estáticos:
//  - apps/web/lib/icon-overrides.json: ícones de public/icones/ que sobrepõem os SVGs antigos;
//  - apps/web/lib/art-manifest.json: páginas/capas de livros (public/livros/) e slides (public/slides/), que o
//    servidor lê da memória em vez de fazer ~150 existsSync por requisição (lib/art-assets.ts).
// Roda sozinho no `prebuild` do web; rode à mão (`pnpm assets:sync`) depois de adicionar arte nova.
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

// ---- art-manifest.json: nome do arquivo (sem extensão) -> URL pública, por pasta ----
const publicRoot = new URL('../apps/web/public/', import.meta.url).pathname;
const artFile = new URL('../apps/web/lib/art-manifest.json', import.meta.url);

function scanFolder(folder) {
  const out = {};
  let entries;
  try {
    entries = readdirSync(join(publicRoot, folder));
  } catch {
    return out; // pasta ainda não existe
  }
  for (const entry of entries.sort()) {
    const match = /^(.*)\.(webp|png|jpe?g)$/i.exec(entry);
    if (!match) continue;
    const name = match[1];
    const ext = `.${match[2].toLowerCase()}`;
    const prev = out[name];
    // Mesma prioridade de sempre: webp, png, jpg, jpeg.
    if (!prev || EXTS.indexOf(ext) < EXTS.indexOf(prev.slice(prev.lastIndexOf('.')))) out[name] = `/${folder}/${entry}`;
  }
  return out;
}

const art = { livros: scanFolder('livros'), slides: scanFolder('slides') };
writeFileSync(artFile, JSON.stringify(art, null, 2) + '\n');
console.log(
  `${Object.keys(art.livros).length} artes de livros e ${Object.keys(art.slides).length} slides registrados.`,
);

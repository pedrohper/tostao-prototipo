// Regenera os ícones do PWA (public/icones/icon-192.png, icon-512.png, icon-maskable-512.png) a partir do ícone do
// mascote (apps/web/app/icon.png). Rode `pnpm assets:icons` quando o ícone mudar.
// O `sharp` vem emprestado do próprio Next (dependência dele pra otimizar imagens), então não entra no package.json.
import { createRequire } from 'node:module';
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const sharp = createRequire(webRequire.resolve('next/package.json'))('sharp');

const src = new URL('../apps/web/app/icon.png', import.meta.url).pathname;
const out = (name) => new URL(`../apps/web/public/icones/${name}`, import.meta.url).pathname;

const meta = await sharp(src).metadata();
// Cor do fundo do ícone = a cor mais frequente entre os pixels opacos (o fundo amarelo domina o quadro).
const { data } = await sharp(src).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
const counts = new Map();
for (let i = 0; i < data.length; i += 3) {
  const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
const [r, g, b] = [...counts.entries()]
  .sort((x, y) => y[1] - x[1])[0][0]
  .split(',')
  .map(Number);

const resize = (size) => sharp(src).resize(size, size, { kernel: 'lanczos3' });
await resize(192).png({ compressionLevel: 9 }).toFile(out('icon-192.png'));
await resize(512).png({ compressionLevel: 9 }).toFile(out('icon-512.png'));

// Maskable: o sistema recorta num círculo/arredondado, então o fundo vai até a borda (opaco) e o mascote fica na zona segura (80%).
// Antes de reduzir, corta a margem do ícone (os cantos arredondados e o fundo ao redor), senão o contorno dele aparece
// como um quadradinho mais claro dentro do fundo cheio.
const pad = Math.round(meta.width * 0.07);
const inner = await sharp(src)
  .extract({ left: pad, top: pad, width: meta.width - 2 * pad, height: meta.height - 2 * pad })
  .resize(Math.round(512 * 0.78), Math.round(512 * 0.78), { kernel: 'lanczos3' })
  .png()
  .toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 3, background: { r, g, b } } })
  .composite([{ input: inner, gravity: 'center' }])
  .png({ compressionLevel: 9 })
  .toFile(out('icon-maskable-512.png'));
console.log(`Ícones PWA regenerados de icon.png (${meta.width}px), fundo rgb(${r}, ${g}, ${b}).`);

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

// Maskable: o sistema recorta num círculo/arredondado, então o fundo precisa ser opaco até as bordas.
// Como o ícone do mascote preenche o quadro inteiro (orelhas e boné sangrando na borda), achatamos direto sobre a cor
// dominante sem encolher pra não criar degrau quadrado no boné nem nas orelhas; a zona segura central (80%) já preserva
// olhos, focinho e sorriso intactos.
await sharp(src)
  .resize(512, 512, { kernel: 'lanczos3' })
  .flatten({ background: { r, g, b } })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile(out('icon-maskable-512.png'));
console.log(`Ícones PWA regenerados de icon.png (${meta.width}px), fundo rgb(${r}, ${g}, ${b}).`);

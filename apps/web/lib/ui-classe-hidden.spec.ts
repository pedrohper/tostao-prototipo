import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');

// A classe solta `hidden` seguida de uma variante que reexibe (ex.: `hidden lg:block`) quebra quando uma extensão do
// navegador injeta o próprio `.hidden { display: none }`: no Tailwind 4 as utilidades ficam em @layer, e CSS de fora
// de camada ganha delas mesmo sem !important. `max-lg:hidden` diz a mesma coisa sem usar essa classe.
const soHidden = /(^|\s)hidden(\s|$)/;
const reexibe =
  /(^|\s)([\w-]+(\[[^\]]*\])?:)+(block|inline|inline-block|flex|inline-flex|grid|inline-grid|contents|table|table-cell|table-row|list-item|flow-root)(\s|$)/;

const arquivos = ['app', 'components'].flatMap((pasta) =>
  readdirSync(join(root, pasta), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('.spec.tsx'))
    .map((f) => join(pasta, f)),
);

describe('Mostrar por tamanho de tela sem a classe solta "hidden"', () => {
  it('encontra os arquivos de tela', () => {
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it('usa max-*:hidden no lugar de "hidden <variante>:<display>"', () => {
    const achados = arquivos.flatMap((arquivo) => {
      const textos = readFileSync(join(root, arquivo), 'utf8').match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) ?? [];
      return textos
        .map((t) => t.slice(1, -1))
        .filter((t) => soHidden.test(t) && reexibe.test(t))
        .map((t) => `${arquivo}: ${t}`);
    });
    expect(achados).toEqual([]);
  });
});

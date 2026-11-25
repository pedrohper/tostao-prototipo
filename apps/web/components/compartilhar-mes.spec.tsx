// T6.19 · botão e painel de compartilhar o mês (renderToString + guardas de fonte, sem navegador).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompartilharMes, CompartilharPainel } from './compartilhar-mes';

const read = (file: string) => readFileSync(join(__dirname, '..', file), 'utf8');

describe('compartilhar o mês', () => {
  it('o botão abre um diálogo (nada é buscado antes do toque)', () => {
    const html = renderToString(<CompartilharMes month="2026-10" monthName="outubro" />);
    expect(html).toContain('Compartilhar');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('role="dialog"');
  });

  it('o painel começa com os valores escondidos e o compartilhar travado até a imagem chegar', () => {
    const html = renderToString(<CompartilharPainel month="2026-10" monthName="outubro" onClose={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Mostrar valores em R$');
    expect(html).toMatch(/<input type="checkbox"(?![^>]*checked)/);
    expect(html).toMatch(/<button type="button" disabled=""[^>]*>Compartilhar imagem<\/button>/);
    expect(html).toContain('Desenhando');
  });

  it('manda o arquivo pelo Web Share direto no toque e baixa quando não tem suporte', () => {
    const source = read('components/compartilhar-mes.tsx');
    expect(source).toContain('navigator.canShare?.({ files: [ready.file] })');
    expect(source).toContain('navigator.share({ files: [ready.file] })');
    expect(source).toContain('a.download = ready.file.name');
    expect(source.slice(source.indexOf('function share()'), source.indexOf('return ('))).not.toContain('await');
  });

  it('o fechamento usa o novo botão', () => {
    expect(read('app/(app)/fechamento/page.tsx')).toContain('<CompartilharMes');
  });
});

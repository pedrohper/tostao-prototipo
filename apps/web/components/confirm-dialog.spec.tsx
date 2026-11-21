// T2.4 · ConfirmDialog: markup acessível (alertdialog, rótulo e descrição ligados, "Cancelar" antes do destrutivo).
// Sem jsdom: o painel (sem portal) renderiza com renderToString; o foco/Esc/trap estão em lib/dialog-focus.spec.ts.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, ConfirmDialogPanel, ConfirmSubmitButton } from './confirm-dialog';

const base = {
  title: 'Apagar este lançamento?',
  description: 'Essa ação não pode ser desfeita.',
  confirmLabel: 'Apagar',
  cancelLabel: 'Cancelar',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDialogPanel', () => {
  const html = renderToString(<ConfirmDialogPanel {...base} />);

  it('é um alertdialog modal, nomeado pelo título e descrito pelo texto', () => {
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    const labelledby = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    const describedby = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(labelledby).toBeTruthy();
    expect(describedby).toBeTruthy();
    expect(html).toContain(`id="${labelledby}"`);
    expect(html).toContain(`id="${describedby}"`);
    expect(html).toContain('Apagar este lançamento?');
    expect(html).toContain('Essa ação não pode ser desfeita.');
  });

  it('Cancelar vem antes de Apagar (é o primeiro focável) e o painel é focável por script (tabindex=-1)', () => {
    expect(html.indexOf('Cancelar')).toBeLessThan(html.lastIndexOf('Apagar</button>'));
    expect(html).toContain('tabindex="-1"');
  });

  it('sem descrição, não aponta aria-describedby pra um id que não existe', () => {
    const noDesc = renderToString(<ConfirmDialogPanel {...base} description={undefined} />);
    expect(noDesc).not.toContain('aria-describedby');
  });

  it('o botão destrutivo é vermelho; fora do modo destrutivo, neutro', () => {
    expect(html).toContain('bg-vermelho-texto');
    expect(renderToString(<ConfirmDialogPanel {...base} destructive={false} />)).not.toContain('bg-vermelho-texto');
  });
});

describe('ConfirmDialog (com portal)', () => {
  it('fechado não renderiza nada', () => {
    expect(renderToString(<ConfirmDialog {...base} open={false} />)).toBe('');
  });
});

describe('ConfirmSubmitButton', () => {
  it('renderiza um botão de enviar com name/value (serie=1) e avisa que abre um diálogo; o diálogo começa fechado', () => {
    const html = renderToString(
      <form>
        <ConfirmSubmitButton {...base} name="serie" value="1" className="x">
          Apagar série
        </ConfirmSubmitButton>
      </form>,
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain('name="serie"');
    expect(html).toContain('value="1"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('alertdialog');
  });
});

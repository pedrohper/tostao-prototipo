// T4.1 · ToastProvider/ToastViewport: markup acessível (live region sempre presente, role por variante, botão de ação).
// Sem jsdom: renderToString cobre o markup; o comportamento (fila, limite, dedupe, expiração) está em toast-state.spec.ts.
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createToast } from '@/lib/toast-state';
import { ToastProvider, ToastViewport, useToast } from './toast';

const noop = () => {};

describe('ToastProvider', () => {
  it('renderiza os filhos e deixa a live region polite no DOM mesmo sem toast', () => {
    const html = renderToString(
      <ToastProvider>
        <p>conteúdo do app</p>
      </ToastProvider>,
    );
    expect(html).toContain('conteúdo do app');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
  });

  it('useToast() fora do provider não quebra: só não mostra nada', () => {
    let returned: string | undefined;
    function Probe() {
      const api = useToast();
      returned = api.success('oi');
      api.dismiss('x');
      return <span>ok</span>;
    }
    expect(renderToString(<Probe />)).toContain('ok');
    expect(returned).toBe('');
  });

  it('useToast() dentro do provider entrega a API completa', () => {
    let keys: string[] = [];
    function Probe() {
      keys = Object.keys(useToast()).sort();
      return null;
    }
    renderToString(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );
    expect(keys).toEqual(['dismiss', 'error', 'info', 'success', 'toast']);
  });
});

describe('ToastViewport', () => {
  it('sucesso e info usam role=status; erro usa role=alert', () => {
    const html = renderToString(
      <ToastViewport
        dismissLabel="Fechar aviso"
        onDismiss={noop}
        toasts={[
          createToast({ message: 'Gasto anotado.', variant: 'success' }, 'a'),
          createToast({ message: 'Dica rápida', variant: 'info' }, 'b'),
          createToast({ message: 'Não salvou', variant: 'error' }, 'c'),
        ]}
      />,
    );
    expect(html.match(/role="status"/g)).toHaveLength(2);
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain('Gasto anotado.');
    expect(html).toContain('data-variant="error"');
  });

  it('toast com "Desfazer" mostra o botão de ação; sem ação, só o de fechar', () => {
    const html = renderToString(
      <ToastViewport
        dismissLabel="Fechar aviso"
        onDismiss={noop}
        toasts={[
          createToast({ message: 'Meta apagada.', actionLabel: 'Desfazer', onAction: noop }, 'a'),
          createToast({ message: 'Salvo.' }, 'b'),
        ]}
      />,
    );
    expect(html.match(/Desfazer/g)).toHaveLength(1);
    expect(html.match(/aria-label="Fechar aviso"/g)).toHaveLength(2);
  });

  it('a animação só vale com movimento permitido (prefers-reduced-motion)', () => {
    const html = renderToString(
      <ToastViewport dismissLabel="Fechar" onDismiss={noop} toasts={[createToast({ message: 'Oi' }, 'a')]} />,
    );
    expect(html).toContain('motion-safe:animate-');
    expect(html).not.toMatch(/(^|[\s"])animate-\[/);
  });
});

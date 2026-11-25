// T6.15 · controles novos dos simuladores e o modo sem palpite do shell.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import { useState } from 'react';
import { Selo } from './selo';
import { CampoLista, CampoOpcoes, CampoSimNao, Quadros } from './simulador-campos';
import { letraDoNumero, SimuladorShell, valorEhFrase } from './simulador-shell';
import { aberto, grande, plain, tocar, tudo } from './simulador.testutil';

function Exemplo() {
  const [metodo, setMetodo] = useState<'a' | 'b'>('a');
  const [sim, setSim] = useState(true);
  const [marcados, setMarcados] = useState<string[]>(['x']);
  return (
    <SimuladorShell
      pergunta="Qual caminho?"
      aviso={<p>Veio do seu extrato</p>}
      resultado={{ rotulo: 'Escolha', valor: `${metodo}-${sim ? 's' : 'n'}-${marcados.join('')}`, tom: 'bom' }}
      explicacao="porque sim"
      principal={
        <CampoOpcoes
          rotulo="Método"
          opcoes={[
            { id: 'a', rotulo: 'Opção A' },
            { id: 'b', rotulo: 'Opção B' },
          ]}
          valor={metodo}
          onChange={setMetodo}
        />
      }
      extras={
        <>
          <CampoSimNao rotulo="É urgente?" valor={sim} onChange={setSim} />
          <CampoLista
            rotulo="Itens"
            itens={[
              { id: 'x', rotulo: 'Item X', valor: 'R$ 10,00' },
              { id: 'y', rotulo: 'Item Y' },
            ]}
            marcados={marcados}
            onAlternar={(id) => setMarcados((m) => (m.includes(id) ? m.filter((i) => i !== id) : [...m, id]))}
          />
        </>
      }
    />
  );
}

describe('shell sem palpite', () => {
  it('abre direto no resultado, com o aviso à vista', () => {
    const html = renderToString(<Exemplo />);
    expect(html).not.toContain('Pular palpite');
    expect(html).toContain('Veio do seu extrato');
    expect(grande(aberto(Exemplo))).toBe('Escolha a-s-x');
  });
});

describe('controles', () => {
  it('opções, sim ou não e lista mudam o resultado', () => {
    const tela = aberto(Exemplo);
    tocar(tela, 'Opção B');
    tocar(tela, 'Não');
    tocar(tela, 'Item Y');
    tocar(tela, 'Item X');
    expect(grande(tela)).toBe('Escolha b-n-y');
  });

  it('o estado marcado é anunciado (radio e checkbox)', () => {
    const tela = aberto(Exemplo);
    const marcado = (papel: string) =>
      tela
        .todos((no) => no.props.role === papel && no.props['aria-checked'] === true)
        .map((no) => plain(tela.texto(no)));
    expect(marcado('radio')).toEqual(['Opção A', 'Sim']);
    expect(marcado('checkbox')).toEqual(['Item X R$ 10,00']);
  });

  it('setas andam entre as opções e já escolhem', () => {
    const tela = aberto(Exemplo);
    const primeira = tela.todos((no) => no.props.role === 'radio')[0]!;
    tela.disparar(primeira, 'onKeyDown', {
      key: 'ArrowRight',
      preventDefault: () => undefined,
      currentTarget: { parentElement: null },
    });
    expect(grande(tela)).toBe('Escolha b-s-x');
  });

  it('quadros: lado a lado só com dois valores curtos, senão um por linha', () => {
    const lado = (valores: string[]) =>
      renderToString(<Quadros itens={valores.map((valor, i) => ({ rotulo: `R${i}`, valor }))} />).includes(
        'grid-cols-2',
      );
    expect(lado(['R$ 80,00', 'R$ 800,00'])).toBe(true);
    expect(lado(['R$ 80,00', 'R$ 1.600,00'])).toBe(false);
    expect(lado(['1', '2', '3'])).toBe(false);
  });

  it('quadros: os rótulos e valores aparecem', () => {
    const tela = aberto(() => (
      <Quadros
        titulo="No ano"
        itens={[
          { rotulo: 'Em 3 meses', valor: 'R$ 1,00' },
          { rotulo: 'Em 1 ano', valor: 'R$ 4,00', tom: 'ruim' },
        ]}
      />
    ));
    expect(tudo(tela)).toBe('No ano Em 3 meses R$ 1,00 Em 1 ano R$ 4,00');
  });
});

describe('resultado por extenso', () => {
  it('número usa letra grande; frase longa, menor', () => {
    expect(valorEhFrase('R$ 12.345,67')).toBe(false);
    expect(valorEhFrase('Alto risco de golpe')).toBe(true);
  });

  it('o número grande não passa de 36 px e encolhe com o cartão quando é comprido', () => {
    expect(letraDoNumero('R$ 984,00')).toBe('min(36px, 17.92cqi)');
    expect(letraDoNumero('R$ 1.234.567,00')).toBe('min(36px, 10.75cqi)');
    // 214 px é o cartão em 320 px: o valor comprido cabe (letra x 0,62 x caracteres <= largura).
    expect(((10.75 / 100) * 214 * 0.62 * 15) | 0).toBeLessThanOrEqual(214);
  });
});

describe('ícones das explicações no tema escuro', () => {
  it('os selos de fundo azul usam a tinta do tema (a fixa sumia no escuro)', () => {
    for (const tipo of ['dados', 'tempo', 'lei'] as const) {
      const html = renderToString(<Selo tipo={tipo} />);
      expect(html, tipo).toContain('bg-azul text-tinta');
      expect(html, tipo).not.toContain('text-tinta-fixa');
    }
  });
});

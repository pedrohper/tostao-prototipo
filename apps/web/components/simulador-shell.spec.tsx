// T6.13 · SimuladorShell: o palpite segura o resultado, "Ajustar mais" nasce fechado, dá pra digitar o valor e a
// régua acompanha. Markup inicial com renderToString; toques e digitação com o `montar` (o projeto não tem jsdom).
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const { comGanchosDeTeste } = await import('./mini-render.testutil');
  return comGanchosDeTeste(await importOriginal<typeof import('react')>());
});

import { money } from '@/lib/format';
import { montar, type No } from './mini-render.testutil';
import { CampoDinheiro, SimuladorShell, encaixarNaRegua, lerReais, passoDaRegua } from './simulador-shell';

/** Um simulador de mentira: sobra = ganho − R$ 1.000,00. */
function Exemplo() {
  const [ganho, setGanho] = useState(120_000);
  const [custo, setCusto] = useState(100_000);
  const sobra = ganho - custo;
  return (
    <SimuladorShell
      pergunta="Dá pra pagar?"
      cenario={[
        { rotulo: 'Ganho', valor: money(ganho) },
        { rotulo: 'Custo', valor: money(custo) },
      ]}
      palpites={[
        { id: 'sim', rotulo: 'Dá sim' },
        { id: 'nao', rotulo: 'Não dá' },
      ]}
      resultado={{ rotulo: 'Sobra por mês', valor: money(sobra), tom: sobra >= 0 ? 'bom' : 'ruim', sobra }}
      respostaCerta={(r) => (r.sobra >= 0 ? 'sim' : 'nao')}
      explicacao={<p>Explicação com {money(sobra)}.</p>}
      principal={
        <CampoDinheiro rotulo="Ganho" valor={ganho} min={50_000} max={300_000} passo={5_000} onChange={setGanho} />
      }
      resumoExtras="Já descontei o custo"
      extras={<CampoDinheiro rotulo="Custo" valor={custo} min={0} max={200_000} passo={5_000} onChange={setCusto} />}
    />
  );
}

type Tela = ReturnType<typeof montar>;

const papel = (role: string) => (no: No) => no.props.role === role;
const radios = (tela: Tela) => tela.todos(papel('radio'));
const regioes = (tela: Tela) => tela.todos((no) => no.props['aria-live'] === 'polite');
const resultado = (tela: Tela) => tela.texto(regioes(tela)[0]);
const botao = (tela: Tela, nome: string) =>
  tela.um((no) => no.tag === 'button' && tela.texto(no) === nome, `o botão "${nome}"`);
const campos = (tela: Tela) => tela.todos((no) => no.tag === 'input' && no.props.inputMode === 'decimal');
const reguas = (tela: Tela) => tela.todos((no) => no.tag === 'input' && no.props.type === 'range');
const pular = (tela: Tela) => tela.disparar(botao(tela, 'Pular palpite'), 'onClick');
const focar = (tela: Tela, i = 0) =>
  tela.disparar(campos(tela)[i]!, 'onFocus', { target: { select: () => undefined } });
const digitar = (tela: Tela, texto: string, i = 0) =>
  tela.disparar(campos(tela)[i]!, 'onChange', { target: { value: texto } });
const sair = (tela: Tela, i = 0) => tela.disparar(campos(tela)[i]!, 'onBlur');

describe('SimuladorShell · antes do palpite', () => {
  const html = renderToString(<Exemplo />);

  it('mostra a pergunta, os números e os palpites como um radiogroup com nome', () => {
    const label = html.match(/role="radiogroup" aria-labelledby="([^"]+)"/)?.[1];
    expect(label).toBeTruthy();
    expect(html).toMatch(new RegExp(`<h2 id="${label}"[^>]*>Dá pra pagar\\?</h2>`));
    expect(html.match(/role="radio"/g)).toHaveLength(2);
    expect(html.match(/aria-checked="false"/g)).toHaveLength(2);
    expect(html).toContain('R$ 1.200,00'.replace(' ', '\u00a0'));
    expect(html).toContain('Pular palpite');
  });

  it('o resultado fica bloqueado: a região ao vivo existe mas está vazia, sem controles nem explicação', () => {
    expect(html).toMatch(/<div aria-live="polite" aria-atomic="true" class="sr-only"><\/div>/);
    expect(html).not.toContain('Sobra por mês');
    expect(html).not.toContain('Explicação');
    expect(html).not.toContain('Ajustar mais');
    expect(html).not.toContain('type="range"');
  });

  it('alvos de toque de pelo menos 44 px nos palpites e no "Pular"', () => {
    expect(html.match(/role="radio"[^>]*class="[^"]*min-h-\[52px\]/g)).toHaveLength(2);
    expect(html).toMatch(/<button type="button" class="[^"]*min-h-11[^"]*">Pular palpite/);
  });
});

describe('SimuladorShell · palpite', () => {
  it('só libera o resultado depois de responder, e diz se acertou', () => {
    const tela = montar(<Exemplo />);
    expect(resultado(tela)).toBe('');
    tela.disparar(radios(tela)[0]!, 'onClick');
    expect(resultado(tela)).toContain('Sobra por mês R$ 200,00');
    expect(tela.texto()).toContain('Mandou bem!');
    expect(tela.texto()).toContain('Você achou: Dá sim . Na real: Dá sim .');
    expect(radios(tela)).toHaveLength(0);
    expect(tela.texto()).not.toContain('Pular palpite');
  });

  it('palpite errado: "Você achou X. Na real: Y.", sem bronca', () => {
    const tela = montar(<Exemplo />);
    tela.disparar(radios(tela)[1]!, 'onClick');
    expect(tela.texto()).toContain('Boa tentativa!');
    expect(tela.texto()).toContain('Você achou: Não dá . Na real: Dá sim .');
  });

  it('pular libera o resultado sem comentar palpite', () => {
    const tela = montar(<Exemplo />);
    pular(tela);
    expect(resultado(tela)).toContain('R$ 200,00');
    expect(tela.texto()).not.toContain('Você achou');
  });

  it('a resposta do palpite fica como estava; mexendo nos números, avisa que valia pros do começo', () => {
    const tela = montar(<Exemplo />);
    tela.disparar(radios(tela)[0]!, 'onClick');
    expect(tela.texto()).not.toContain('Isso valia pros números do começo');
    tela.disparar(reguas(tela)[0]!, 'onChange', { target: { value: '50000' } });
    expect(resultado(tela)).toContain('-R$ 500,00');
    expect(tela.texto()).toContain('Na real: Dá sim');
    expect(tela.texto()).toContain('Isso valia pros números do começo');
  });

  it('setas andam entre as opções sem escolher nenhuma', () => {
    const tela = montar(<Exemplo />);
    const foco = [vi.fn(), vi.fn()];
    const preventDefault = vi.fn();
    tela.disparar(radios(tela)[0]!, 'onKeyDown', {
      key: 'ArrowDown',
      preventDefault,
      currentTarget: { parentElement: { querySelectorAll: () => foco.map((focus) => ({ focus })) } },
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(foco[1]).toHaveBeenCalledTimes(1);
    expect(radios(tela).map((r) => r.props.tabIndex)).toEqual([-1, 0]);
    expect(resultado(tela)).toBe('');
  });
});

describe('SimuladorShell · depois de liberado', () => {
  it('o resultado fica preso no topo e só ele está na região ao vivo', () => {
    const tela = montar(<Exemplo />);
    pular(tela);
    const [regiao] = regioes(tela);
    expect(regiao!.props.className).toContain('sticky top-0');
    expect(tela.texto(regiao)).not.toContain('Explicação');
  });

  it('um controle à vista; "Ajustar mais" fechado por padrão, com o resumo do que está lá dentro', () => {
    const tela = montar(<Exemplo />);
    pular(tela);
    const [mais] = tela.todos((no) => no.tag === 'details');
    expect(mais!.props.open).toBeUndefined();
    expect(tela.texto(mais)).toContain('Ajustar mais Já descontei o custo');
    // o principal está fora do <details>; o extra, dentro
    expect(reguas(tela)).toHaveLength(2);
    expect(tela.texto(mais)).not.toContain('Ganho');
    expect(tela.texto(mais)).toContain('Custo');
    const [resumo] = tela.todos((no) => no.tag === 'summary');
    expect(resumo!.props.className).toContain('min-h-14');
  });
});

describe('digitar o valor', () => {
  const abrir = () => {
    const tela = montar(<Exemplo />);
    pular(tela);
    return tela;
  };

  it('digitar R$ 1.230 atualiza a régua e o resultado, sem arredondar pro passo', () => {
    const tela = abrir();
    focar(tela);
    digitar(tela, 'R$ 1.230');
    expect(reguas(tela)[0]!.props.value).toBe(123_000);
    expect(reguas(tela)[0]!.props.step).toBe(1);
    expect(reguas(tela)[0]!.props['aria-valuetext']).toBe(money(123_000));
    expect(resultado(tela)).toContain('R$ 230,00');
    expect(campos(tela)[0]!.props.value).toBe('R$ 1.230'); // enquanto digita, o texto é da pessoa
    sair(tela);
    expect(campos(tela)[0]!.props.value).toBe('1.230,00');
    expect(reguas(tela)[0]!.props.value).toBe(123_000);
  });

  it('tecla por tecla: o que ainda não cabe na régua não mexe em nada', () => {
    const tela = abrir();
    focar(tela);
    for (const parcial of ['1', '14', '140']) {
      digitar(tela, parcial);
      expect(reguas(tela)[0]!.props.value, parcial).toBe(120_000);
    }
    digitar(tela, '1400');
    expect(reguas(tela)[0]!.props.value).toBe(140_000);
    expect(reguas(tela)[0]!.props.step).toBe(5_000);
  });

  it('fora do limite: ajusta pro limite ao sair e explica', () => {
    const tela = abrir();
    focar(tela);
    digitar(tela, '9.000');
    expect(reguas(tela)[0]!.props.value).toBe(120_000);
    sair(tela);
    expect(reguas(tela)[0]!.props.value).toBe(300_000);
    expect(tela.texto()).toContain('Aqui vai de R$ 500,00 a R$ 3.000,00, então ajustei pro limite.');
  });

  it('ilegível volta pro valor de antes e avisa', () => {
    const tela = abrir();
    focar(tela);
    digitar(tela, '1,500');
    sair(tela);
    expect(reguas(tela)[0]!.props.value).toBe(120_000);
    expect(campos(tela)[0]!.props.value).toBe('1.200,00');
    expect(tela.texto()).toContain('Não entendi esse valor');
  });

  it('apagar tudo: zero quando o campo aceita zero; senão, volta o de antes', () => {
    const tela = abrir();
    focar(tela, 0);
    digitar(tela, '', 0);
    sair(tela, 0);
    expect(reguas(tela)[0]!.props.value).toBe(120_000);
    focar(tela, 1);
    digitar(tela, '', 1);
    sair(tela, 1);
    expect(reguas(tela)[1]!.props.value).toBe(0);
    expect(campos(tela)[1]!.props.value).toBe('0,00');
    expect(tela.texto()).not.toContain('Não entendi');
  });

  it('Enter confirma (tira o foco do campo)', () => {
    const tela = abrir();
    const blur = vi.fn();
    const preventDefault = vi.fn();
    tela.disparar(campos(tela)[0]!, 'onKeyDown', { key: 'Enter', preventDefault, currentTarget: { blur } });
    expect(blur).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
  });

  it('campo com rótulo, teclado numérico e régua de 44 px', () => {
    const tela = abrir();
    const campo = campos(tela)[0]!;
    expect(tela.todos((no) => no.tag === 'label' && no.props.htmlFor === campo.props.id)).toHaveLength(1);
    expect(campo.props.inputMode).toBe('decimal');
    for (const regua of reguas(tela)) expect(regua.props.style).toMatchObject({ height: 44 });
  });
});

describe('contas dos controles', () => {
  it('lerReais(): números digitados são reais; ambíguo ou ilegível é null', () => {
    expect(lerReais('1230')).toBe(123_000);
    expect(lerReais('R$ 1.230')).toBe(123_000);
    expect(lerReais('R$\u00a01.230,50')).toBe(123_050);
    expect(lerReais('12,5')).toBe(1_250);
    expect(lerReais('0')).toBe(0);
    expect(lerReais('0,00')).toBe(0);
    for (const ruim of ['', 'abc', '1,500', '-5', '1.', '999999999999']) expect(lerReais(ruim), ruim).toBeNull();
  });

  it('passoDaRegua(): passo normal no grid, centavo a centavo fora dele', () => {
    expect(passoDaRegua(125_000, 50_000, 5_000)).toBe(5_000);
    expect(passoDaRegua(123_000, 50_000, 5_000)).toBe(1);
    expect(passoDaRegua(14.5, 10, 0.5)).toBe(0.5);
  });

  it('encaixarNaRegua(): volta pro passo andando pro lado do movimento, dentro dos limites', () => {
    expect(encaixarNaRegua(123_001, 123_000, 50_000, 300_000, 5_000)).toBe(125_000);
    expect(encaixarNaRegua(122_999, 123_000, 50_000, 300_000, 5_000)).toBe(120_000);
    expect(encaixarNaRegua(130_000, 125_000, 50_000, 300_000, 5_000)).toBe(130_000);
    expect(encaixarNaRegua(299_999, 298_000, 50_000, 300_000, 5_000)).toBe(300_000);
    expect(encaixarNaRegua(50_001, 51_000, 50_000, 300_000, 5_000)).toBe(50_000);
  });
});

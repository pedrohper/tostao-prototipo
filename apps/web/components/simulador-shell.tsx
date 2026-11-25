'use client';
// SimuladorShell (T6.13): o layout dos simuladores, uma coisa por vez. Pergunta → palpite (opcional) → resultado grande
// que fica preso no topo enquanto a pessoa mexe → um controle principal → o resto em "Ajustar mais".
// O shell não faz conta: cada simulador calcula e entrega o resultado já formatado.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Mascot } from '@/components/mascote';
import { TostaoSlider } from '@/components/tostao-slider';
import { money } from '@/lib/format';
import { centsFromMasked, formatCents, maskPastedMoney } from '@/lib/money-mask';

export type TomDoResultado = 'bom' | 'atencao' | 'ruim';

/** O que aparece no cartão grande. O simulador pode juntar os números dele no mesmo objeto (usados em `respostaCerta`). */
export type ResultadoDoSimulador = {
  /** O que o número significa: "Sobra por mês". */
  rotulo: string;
  /** Já formatado: "R$ 250,00". */
  valor: string;
  tom: TomDoResultado;
  /** Uma linha curta embaixo do número. */
  nota?: string;
};

export type Palpite<Id extends string = string> = { id: Id; rotulo: string };

/** Uma linha do "com esses números" que a pessoa lê antes de chutar. */
export type ItemDoCenario = { rotulo: string; valor: string };

export type SimuladorShellProps<R extends ResultadoDoSimulador, Id extends string> = {
  pergunta: string;
  /** Faixa de contexto logo abaixo da pergunta (ex.: "isto veio do seu extrato"). */
  aviso?: ReactNode;
  cenario?: readonly ItemDoCenario[];
  /** 2 ou 3 opções. Sem palpites (um quiz já é um chute), o simulador abre direto no resultado. */
  palpites?: readonly Palpite<Id>[];
  resultado: R;
  respostaCerta?: (resultado: R) => Id;
  /** A frase que explica o número, recalculada junto com ele. */
  explicacao: ReactNode;
  /** O único controle à vista. */
  principal: ReactNode;
  /** Os demais controles, dentro de "Ajustar mais" (fechado). */
  extras?: ReactNode;
  /** O que já entra na conta lá dentro, pra ninguém se assustar com o número. */
  resumoExtras?: string;
  /** Conteúdo de apoio depois dos controles (tabela, mês a mês). */
  detalhes?: ReactNode;
};

type Fase =
  | { nome: 'palpite' }
  | { nome: 'pulou' }
  /** `foto` = os números na hora do chute: se a pessoa mexer depois, a tela avisa que a resposta era daqueles. */
  | { nome: 'palpitou'; achou: string; real: string; acertou: boolean; foto: string };

const TONS: Record<TomDoResultado, { fundo: string; rotulo: string }> = {
  bom: { fundo: 'bg-menta-clara', rotulo: 'text-verde-texto' },
  atencao: { fundo: 'bg-amarelo-claro', rotulo: 'text-laranja-texto' },
  ruim: { fundo: 'bg-rosa', rotulo: 'text-vermelho-texto' },
};

/** Número cabe grande; um veredito por extenso ("Alto risco de golpe") precisa de letra menor pra não virar parede. */
export const valorEhFrase = (valor: string) => valor.length > 16;

export function SimuladorShell<R extends ResultadoDoSimulador, Id extends string>({
  pergunta,
  aviso,
  cenario = [],
  palpites,
  resultado,
  respostaCerta,
  explicacao,
  principal,
  extras,
  resumoExtras,
  detalhes,
}: SimuladorShellProps<R, Id>) {
  const temPalpite = Boolean(palpites?.length && respostaCerta);
  const [fase, setFase] = useState<Fase>(() => ({ nome: temPalpite ? 'palpite' : 'pulou' }));
  const idPergunta = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const revelado = fase.nome !== 'palpite';
  const foto = cenario.map((item) => item.valor).join('|');
  const tom = TONS[resultado.tom];

  useEffect(() => {
    const el = raiz.current;
    // Sem palpite o resultado já nasce aberto: nada de puxar o foco (e a rolagem) quando a tela carrega.
    if (!temPalpite || !revelado || !el) return;
    // O botão tocado sumiu: o foco fica no simulador e, se o topo ficou pra trás, a tela volta até ele.
    el.focus({ preventScroll: true });
    if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
  }, [temPalpite, revelado]);

  const palpitar = (id: Id) => {
    if (!respostaCerta) return;
    const certa = respostaCerta(resultado);
    const rotulo = (alvo: Id) => palpites?.find((p) => p.id === alvo)?.rotulo ?? alvo;
    setFase({ nome: 'palpitou', achou: rotulo(id), real: rotulo(certa), acertou: id === certa, foto });
  };

  return (
    <div ref={raiz} tabIndex={-1} data-simulador-shell="" className="flex scroll-mt-3 flex-col gap-4 outline-none">
      <h2
        id={idPergunta}
        className={`font-display font-extrabold text-balance ${
          revelado ? 'text-[18px] leading-[23px]' : 'text-[24px] leading-[29px]'
        }`}
      >
        {pergunta}
      </h2>

      {aviso}

      {!revelado && palpites && (
        <div className="flex flex-col gap-4">
          {cenario.length > 0 && (
            <dl className="flex flex-col gap-2 rounded-2xl bg-papel-2 p-3.5">
              {cenario.map((item) => (
                <div key={item.rotulo} className="flex items-baseline justify-between gap-3 text-[14px] leading-snug">
                  <dt className="min-w-0 text-tinta-suave">{item.rotulo}</dt>
                  <dd className="shrink-0 font-semibold text-tinta tabular-nums">{item.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          <span className="text-[13px] font-semibold text-tinta-suave">Chuta antes de ver a conta:</span>
          <GrupoDePalpites opcoes={palpites} rotuladoPor={idPergunta} onEscolher={palpitar} />
          <button
            type="button"
            onClick={() => setFase({ nome: 'pulou' })}
            className="flex min-h-11 items-center justify-center self-center rounded-full px-5 text-[14px] font-semibold text-tinta-suave underline underline-offset-4 hover:text-tinta"
          >
            Pular palpite
          </button>
        </div>
      )}

      {/* A região "ao vivo" existe desde o começo (vazia), senão o leitor de tela não anuncia o resultado. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={revelado ? 'sticky top-0 z-[5] -mx-1 bg-cartao px-1 py-2' : 'sr-only'}
      >
        {revelado && (
          <div className={`flex flex-col items-center gap-1 rounded-[20px] px-4 py-3.5 text-center ${tom.fundo}`}>
            <span className={`text-[13px] leading-tight font-bold ${tom.rotulo}`}>{resultado.rotulo}</span>
            <span
              className={`font-display font-extrabold text-balance break-words text-tinta tabular-nums ${
                valorEhFrase(resultado.valor) ? 'text-[22px] leading-[27px]' : 'text-[36px] leading-[40px]'
              }`}
            >
              {resultado.valor}
            </span>
            {resultado.nota && <span className="text-[13px] leading-snug text-tinta">{resultado.nota}</span>}
          </div>
        )}
      </div>

      <div role="status" className={fase.nome === 'palpitou' ? undefined : 'sr-only'}>
        {fase.nome === 'palpitou' && (
          <div className="flex items-center gap-3">
            <Mascot pose={fase.acertou ? 'comemorando' : 'professor'} size={56} alt="" />
            <div className="flex min-w-0 flex-col gap-0.5 text-[14px] leading-snug">
              <span className="font-display text-[16px] font-extrabold">
                {fase.acertou ? 'Mandou bem!' : 'Boa tentativa!'}
              </span>
              <span>
                Você achou: <b>{fase.achou}</b>. Na real: <b>{fase.real}</b>.
              </span>
              {fase.foto !== foto && (
                <span className="text-xs text-tinta-suave">Isso valia pros números do começo.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {revelado && (
        <>
          <div className="rounded-2xl bg-papel-2 p-3.5 text-[14px] leading-relaxed text-tinta">{explicacao}</div>

          <div className="pt-1">{principal}</div>

          {extras && (
            <details className="group rounded-2xl border-[1.5px] border-linha">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">Ajustar mais</span>
                  {resumoExtras && <span className="text-xs leading-snug text-tinta-suave">{resumoExtras}</span>}
                </span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0 transition-transform group-open:rotate-180"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="flex flex-col gap-5 border-t border-linha p-3.5">{extras}</div>
            </details>
          )}

          {detalhes}
        </>
      )}
    </div>
  );
}

/** Os palpites: um grupo de opções. As setas só andam entre elas; escolher é tocar (ou Espaço/Enter). */
function GrupoDePalpites<Id extends string>({
  opcoes,
  rotuladoPor,
  onEscolher,
}: {
  opcoes: readonly Palpite<Id>[];
  rotuladoPor: string;
  onEscolher: (id: Id) => void;
}) {
  const [foco, setFoco] = useState(0);

  const andar = (event: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const passo = ['ArrowDown', 'ArrowRight'].includes(event.key)
      ? 1
      : ['ArrowUp', 'ArrowLeft'].includes(event.key)
        ? -1
        : 0;
    if (passo === 0) return;
    event.preventDefault();
    const proximo = (indice + passo + opcoes.length) % opcoes.length;
    setFoco(proximo);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[proximo]?.focus();
  };

  return (
    <div role="radiogroup" aria-labelledby={rotuladoPor} className="flex flex-col gap-2.5">
      {opcoes.map((opcao, indice) => (
        <button
          key={opcao.id}
          type="button"
          role="radio"
          aria-checked={false}
          tabIndex={indice === foco ? 0 : -1}
          onKeyDown={(event) => andar(event, indice)}
          onClick={() => onEscolher(opcao.id)}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border-2 border-linha bg-cartao px-4 py-3 text-left text-[15px] leading-snug font-semibold text-tinta hover:border-tinta"
        >
          <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border-2 border-tinta-suave" />
          <span className="min-w-0">{opcao.rotulo}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Controles ----------

/**
 * Texto digitado no campo → centavos. Aqui os números são REAIS ("1230" = R$ 1.230,00), a mesma leitura de um valor
 * colado no "Anotar": num simulador ninguém quer digitar os centavos. Ambíguo ou ilegível → null.
 */
export function lerReais(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, '').trim();
  if (/^0+([.,]0{0,2})?$/.test(limpo)) return 0;
  const mascarado = maskPastedMoney(limpo);
  return mascarado === '' ? null : centsFromMasked(mascarado);
}

/**
 * Régua depois de um valor digitado fora do passo (R$ 1.230 numa régua de 50 em 50): com o passo original o navegador
 * "arredondaria" o pino. Enquanto o valor está fora, a régua aceita qualquer centavo; ao arrastar, volta pro passo.
 */
export function passoDaRegua(valor: number, min: number, passo: number): number {
  return (valor - min) % passo === 0 ? passo : 1;
}

/** Encaixa no passo o que veio da régua, andando pro lado em que a pessoa arrastou (ou apertou a seta). */
export function encaixarNaRegua(novo: number, atual: number, min: number, max: number, passo: number): number {
  const casas = (novo - min) / passo;
  const encaixado = min + (novo > atual ? Math.ceil(casas) : Math.floor(casas)) * passo;
  return Math.min(max, Math.max(min, encaixado));
}

const reais = (cents: number) => formatCents(cents) || '0,00';

/** Valor em dinheiro: toca no número pra digitar, ou arrasta a régua. Tudo em centavos. */
export function CampoDinheiro({
  rotulo,
  valor,
  min,
  max,
  passo,
  onChange,
  dica,
}: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo: number;
  onChange: (cents: number) => void;
  dica?: string;
}) {
  const id = useId();
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [antes, setAntes] = useState(valor);
  const [aviso, setAviso] = useState<string | null>(null);

  const digitar = (texto: string) => {
    setRascunho(texto);
    setAviso(null);
    // Enquanto digita, só aplica o que já cabe na régua; o resto é decidido ao sair do campo.
    const lido = lerReais(texto);
    if (lido !== null && lido >= min && lido <= max) onChange(lido);
  };

  const confirmar = () => {
    if (rascunho === null) return;
    setRascunho(null);
    const vazio = rascunho.replace(/R\$/gi, '').trim() === '';
    const lido = vazio ? (min === 0 ? 0 : null) : lerReais(rascunho);
    if (lido === null) {
      onChange(antes);
      if (!vazio) setAviso('Não entendi esse valor. Digite em reais, tipo 1.230 ou 1.230,50.');
      return;
    }
    const dentro = Math.min(max, Math.max(min, lido));
    onChange(dentro);
    if (dentro !== lido) setAviso(`Aqui vai de ${money(min)} a ${money(max)}, então ajustei pro limite.`);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] leading-tight font-semibold">
        {rotulo}
      </label>
      {/* Caixa inteira com cara de campo: o lápis avisa que o número é digitável. */}
      <div className="flex h-[52px] items-center gap-2 rounded-2xl border-[1.5px] border-linha bg-cartao pr-3.5 pl-4 focus-within:border-laranja">
        <span aria-hidden="true" className="text-[15px] font-semibold text-tinta-suave">
          R$
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={rascunho ?? reais(valor)}
          aria-describedby={aviso ? `${id}-aviso` : undefined}
          onFocus={(event) => {
            setAntes(valor);
            setRascunho(reais(valor));
            setAviso(null);
            event.target.select();
          }}
          onChange={(event) => digitar(event.target.value)}
          onBlur={confirmar}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            event.currentTarget.blur();
          }}
          // scroll-mt: com o teclado aberto, o navegador não esconde o campo atrás do resultado preso no topo.
          className="h-full w-full min-w-0 flex-1 scroll-mt-44 bg-transparent font-display text-[22px] font-extrabold text-tinta tabular-nums outline-none"
        />
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-tinta-suave"
        >
          <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
        </svg>
      </div>
      <TostaoSlider
        min={min}
        max={max}
        step={passoDaRegua(valor, min, passo)}
        value={valor}
        aria-label={rotulo}
        aria-valuetext={money(valor)}
        onChange={(event) => {
          setAviso(null);
          onChange(encaixarNaRegua(Number(event.target.value), valor, min, max, passo));
        }}
        style={{ height: 44 }}
      />
      {dica && !aviso && <span className="text-xs text-tinta-suave">{dica}</span>}
      {aviso && (
        <span id={`${id}-aviso`} role="alert" className="text-xs leading-snug font-semibold text-laranja-texto">
          {aviso}
        </span>
      )}
    </div>
  );
}

/** O que não é dinheiro (horas, porcentagem): rótulo, valor grande e a régua. */
export function CampoRegua({
  rotulo,
  valor,
  min,
  max,
  passo,
  onChange,
  formatar,
}: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo: number;
  onChange: (valor: number) => void;
  formatar: (valor: number) => string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] leading-tight font-semibold">{rotulo}</span>
        <span className="shrink-0 font-display text-[20px] font-extrabold tabular-nums">{formatar(valor)}</span>
      </span>
      <TostaoSlider
        min={min}
        max={max}
        step={passo}
        value={valor}
        aria-label={rotulo}
        aria-valuetext={formatar(valor)}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ height: 44 }}
      />
    </label>
  );
}

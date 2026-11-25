import Link from 'next/link';
import { Icon } from './icone';
import { Eyebrow } from './ui';

type StepItem = {
  number: string;
  icon: string;
  bg: string;
  title: string;
  body: React.ReactNode;
};

const STEPS: readonly StepItem[] = [
  {
    number: '1',
    icon: 'conectar/banco',
    bg: 'bg-menta-clara',
    title: '1. Cria sua conta no MeuPluggy',
    body: (
      <>
        Acessa{' '}
        <a href="https://meu.pluggy.ai" target="_blank" rel="noreferrer" className="font-semibold text-tinta underline">
          meu.pluggy.ai
        </a>{' '}
        e liga seus bancos lá primeiro.
      </>
    ),
  },
  {
    number: '2',
    icon: 'ui/banco',
    bg: 'bg-azul',
    title: '2. Volta aqui e toca em “Conectar”',
    body: 'A gente abre uma janelinha segura direto no Tostão.',
  },
  {
    number: '3',
    icon: 'jogo/dia-cumprido',
    bg: 'bg-amarelo-claro',
    title: '3. Escolhe MeuPluggy e autoriza',
    body: 'Seleciona MeuPluggy na lista, entra na sua conta e pronto!',
  },
];

/**
 * Passo a passo curto e sem jargão pra quem vai ligar o banco via MeuPluggy,
 * usando ícones já existentes do Tostão e uma explicação curta de confiança.
 */
export function ConectarGuia() {
  return (
    <section
      aria-labelledby="conectar-guia-titulo"
      className="flex flex-col gap-3 rounded-[20px] border border-linha bg-papel-2 p-4"
    >
      <div className="flex flex-col gap-0.5">
        <Eyebrow>Como funciona</Eyebrow>
        <h3 id="conectar-guia-titulo" className="font-display text-[18px] leading-6 font-extrabold text-tinta">
          Conectar em 3 passos
        </h3>
      </div>

      <ol className="flex flex-col gap-3">
        {STEPS.map((step) => (
          <li key={step.number} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${step.bg}`}
            >
              <Icon src={step.icon} size={28} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] leading-5 font-bold text-tinta">{step.title}</span>
              <p className="text-[13px] leading-[18px] text-tinta-suave">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <details className="pt-0.5">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-[14px] font-semibold text-tinta underline underline-offset-4">
          Por que preciso disso?
        </summary>
        <p className="mt-1.5 text-[13px] leading-[19px] text-tinta-suave">
          O MeuPluggy faz a ponte oficial com o seu banco. O Tostão só lê seus gastos pra te ajudar a organizar — nunca
          faz Pix, não paga boleto nem movimenta seu dinheiro.
        </p>
      </details>
    </section>
  );
}

/**
 * Alerta humano quando o widget falha ao conectar o banco,
 * oferecendo logo as alternativas de importar extrato (PDF/OFX) ou anotar na mão.
 */
export function WidgetErrorAlert({
  message,
  importarHref = '/importar',
  anotarHref = '/anotar',
}: {
  message?: string;
  importarHref?: string;
  anotarHref?: string;
}) {
  if (!message) return null;

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-linha bg-rosa p-4 text-tinta">
      <p className="text-[14px] leading-5 font-medium">{message}</p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={importarHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-tinta bg-cartao px-3.5 py-2 text-[13px] font-semibold text-tinta no-underline transition-colors hover:bg-papel-2"
        >
          <Icon src="conectar/extrato" size={18} />
          <span>Importar extrato (PDF/OFX)</span>
        </Link>
        <Link
          href={anotarHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-tinta bg-cartao px-3.5 py-2 text-[13px] font-semibold text-tinta no-underline transition-colors hover:bg-papel-2"
        >
          <Icon src="conectar/anotar" size={18} />
          <span>Anotar na mão</span>
        </Link>
      </div>
    </div>
  );
}

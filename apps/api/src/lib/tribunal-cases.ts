// Casos do Tribunal do Tostão. Um por semana, em rodízio. Personagens fictícios.
// O texto usa **negrito** simples; a tela converte.
export type TribunalCase = {
  id: string;
  title: string;
  story: string;
  question: string;
  options: [string, string];
  verdictTitle: string;
  verdict: string;
};

export const TRIBUNAL_CASES: TribunalCase[] = [
  {
    id: 'avista-ou-parcelado',
    title: 'À vista ou parcelado?',
    story: '**Lucas, 22,** tem R$ 3.000 guardados e quer um celular de R$ 2.400. A loja dá **10% de desconto à vista** (R$ 2.160) ou **10x de R$ 240 sem juros**.',
    question: 'O que o Lucas deveria fazer?',
    options: ['À vista com desconto', 'Parcelar em 10x'],
    verdictTitle: 'O veredito do Tostão: depende, mas aqui a conta fecha pro à vista',
    verdict: 'Parcelando, o dinheiro rende no CDB enquanto as parcelas caem, mas como o saldo vai diminuindo, o ganho em 10 meses fica perto de 5%. O desconto de 10% é garantido na hora. **Só que tem uma condição:** à vista deixa o Lucas com R$ 840 guardados. Se isso for toda a reserva dele, parcelar e manter o colchão também é uma escolha sensata.',
  },
  {
    id: 'emprestar-pro-amigo',
    title: 'Empresta pro amigo?',
    story: '**Bia, 20,** tem R$ 900 de reserva. O melhor amigo pediu **R$ 500 emprestado** pra pagar o aluguel atrasado e jurou devolver "mês que vem".',
    question: 'O que a Bia deveria fazer?',
    options: ['Emprestar os R$ 500', 'Ajudar de outro jeito'],
    verdictTitle: 'O veredito do Tostão: só empresta o que topa perder',
    verdict: 'Emprestar pra amigo é bonito, mas mistura grana e amizade. A regra que funciona: **só empresta o valor que você aceitaria nunca mais ver**. Se R$ 500 é mais da metade da reserva da Bia, um valor menor, ou ajudar a negociar o atraso com o dono do imóvel, protege os dois.',
  },
  {
    id: 'cartao-da-loja',
    title: 'Faz o cartão da loja?',
    story: '**Rafa, 24,** tá no caixa e a moça oferece: "faz o cartão da loja e ganha **15% de desconto nessa compra**". A compra é de R$ 300 e ele já tem um cartão de crédito.',
    question: 'O que o Rafa deveria fazer?',
    options: ['Fazer o cartão e pegar o desconto', 'Recusar e pagar normal'],
    verdictTitle: 'O veredito do Tostão: R$ 45 não pagam um cartão a mais',
    verdict: 'O desconto é real, mas o cartão de loja costuma ter **anuidade, juros altos e propaganda pra você voltar**. Mais um cartão também é mais uma fatura pra esquecer. Se ele vai cancelar logo depois e não tem anuidade, até vale. Se não, recusar é o mais seguro.',
  },
  {
    id: 'reserva-ou-viagem',
    title: 'Reserva ou viagem?',
    story: '**Duda, 21,** juntou R$ 2.000 em um ano. Os amigos fecharam uma **viagem de R$ 1.800** pro feriado. Ela ainda não tem reserva de emergência.',
    question: 'O que a Duda deveria fazer?',
    options: ['Ir na viagem', 'Guardar como reserva'],
    verdictTitle: 'O veredito do Tostão: dá pra ir, com um plano pra reconstruir',
    verdict: 'Viver também é importante, e memória com os amigos vale muito. O risco é **ficar sem nada se o celular quebrar mês que vem**. Um meio-termo: ir numa versão mais barata da viagem, ou ir e já combinar quanto vai guardar por mês pra refazer os R$ 2.000.',
  },
  {
    id: 'pix-desconhecido',
    title: 'Pix de quem você não conhece',
    story: '**Gui, 19,** recebeu um Pix de **R$ 250 de um nome desconhecido**. Minutos depois chegou mensagem: "mandei errado, devolve pra essa outra chave aqui, por favor".',
    question: 'O que o Gui deveria fazer?',
    options: ['Devolver pra chave que mandaram', 'Devolver pelo botão do banco'],
    verdictTitle: 'O veredito do Tostão: devolve, mas só pelo próprio app do banco',
    verdict: 'Esse é golpe clássico do Urubu do Pix: o dinheiro "errado" pode ter vindo de outra vítima, e a chave nova é do golpista. **Nunca devolve pra chave que te mandaram por mensagem.** Usa a opção "Devolver" dentro do comprovante no app do banco, que manda de volta pra conta de origem.',
  },
  {
    id: 'primeiro-salario',
    title: 'O primeiro salário',
    story: '**Nina, 18,** recebeu o primeiro salário: **R$ 1.600**. Mora com os pais e quer comprar um fone de R$ 600 pra comemorar.',
    question: 'O que a Nina deveria fazer?',
    options: ['Comprar o fone agora', 'Esperar e guardar uma parte antes'],
    verdictTitle: 'O veredito do Tostão: comemora, mas paga você primeiro',
    verdict: 'Morando com os pais, a Nina tem a melhor fase pra guardar. Comemorar o primeiro salário faz parte! O truque é **separar uma parte assim que cai**, tipo 20%, e gastar o resto sem culpa. Com R$ 320 guardados, o fone de R$ 600 ainda cabe.',
  },
];

const WEEK = 7 * 24 * 60 * 60 * 1000;
// Semana do Tribunal começa na segunda 00h de Brasília e encerra no domingo 23h59.
const EPOCH = Date.parse('2026-11-09T03:00:00Z'); // segunda, 9/11/2026, 00h em Brasília

export function caseOfWeek(now: Date) {
  const week = Math.floor((now.getTime() - EPOCH) / WEEK);
  const idx = ((week % TRIBUNAL_CASES.length) + TRIBUNAL_CASES.length) % TRIBUNAL_CASES.length;
  const endsAt = new Date(EPOCH + (week + 1) * WEEK - 1);
  return { case: TRIBUNAL_CASES[idx]!, endsAt };
}

// Conteúdo da landing comercial (T4.5) como dados: a página só monta o markup e os testes conferem o que NÃO pode
// faltar (recursos, planos, FAQ) e o que NÃO pode aparecer (restrição de idade, promessa de preço, dado de venda).
// Tudo aqui descreve o que o app faz HOJE; o que ainda está sendo liberado diz isso na frase.

export type VitrineTabId = 'inicio' | 'chat' | 'whatsapp' | 'assinaturas' | 'simuladores';

export type VitrineTab = {
  id: VitrineTabId;
  label: string;
  title: string;
  body: string;
  bullets: readonly string[];
  /** Descrição do mockup pra leitor de tela (o desenho em si é decorativo e usa dados fictícios). */
  mockAlt: string;
};

export const VITRINE_TABS: readonly VitrineTab[] = [
  {
    id: 'inicio',
    label: 'Início',
    title: 'Seu mês numa tela só',
    body: 'Saldo, pra onde o dinheiro foi e o que merece atenção, sem abrir planilha.',
    bullets: [
      'Gastos por categoria, com as mesmas cores do gráfico',
      'Evolução dos últimos meses',
      'Anotar um gasto em poucos toques',
    ],
    mockAlt:
      'Exemplo da tela Início: saldo das contas, barra de gastos por categoria e botão Anotar gasto (dados fictícios).',
  },
  {
    id: 'chat',
    label: 'Chat Tostão IA',
    title: 'Pergunte em vez de procurar',
    body: 'Converse com o Tostão sobre o seu dinheiro. As respostas vêm dos seus números, em cartões que levam direto à tela certa.',
    bullets: [
      'Resposta aparecendo enquanto o Tostão escreve',
      'Pra anotar um gasto, ele propõe e você confirma antes de gravar',
      'Só depois do seu aceite, e dá pra desativar quando quiser',
    ],
    mockAlt:
      'Exemplo do chat: pergunta sobre delivery, resposta do Tostão e cartão com o total do mês (dados fictícios).',
  },
  {
    id: 'whatsapp',
    label: 'Tostão no WhatsApp',
    title: 'Anote sem abrir o app',
    body: 'Mande uma mensagem e o Tostão entende. Antes de gravar qualquer coisa ele pede o seu "SIM". Estamos liberando aos poucos.',
    bullets: [
      'Escreva "anota 45 de pizza ontem"',
      'Confirmação obrigatória antes de lançar',
      'Mesmo Tostão, mesmo limite diário do app',
    ],
    mockAlt:
      'Exemplo de conversa no WhatsApp: pedido para anotar uma pizza, pedido de confirmação e resposta SIM (dados fictícios).',
  },
  {
    id: 'assinaturas',
    label: 'Assinaturas',
    title: 'O que você paga todo mês',
    body: 'O Tostão acha as cobranças que se repetem no extrato e mostra o calendário, o total por mês e por ano.',
    bullets: [
      'Próxima cobrança de cada serviço',
      'Avisa quando o mesmo serviço cobra duas vezes',
      'Você escolhe o que ignorar',
    ],
    mockAlt:
      'Exemplo da tela Assinaturas: cartões com a data da próxima cobrança e o total por mês e por ano (dados fictícios).',
  },
  {
    id: 'simuladores',
    label: 'Simuladores',
    title: 'Brinque com a conta antes de decidir',
    body: 'Parcelado vs à vista, reserva de emergência, juros, dívidas. Abra qualquer simulador a qualquer hora, sem fazer a lição.',
    bullets: [
      'Já começa com os seus números quando há extrato',
      'Sliders pra mudar o cenário na hora',
      'Cada um ligado a uma lição de 2 minutos',
    ],
    mockAlt:
      'Exemplo de simulador: dois controles deslizantes e o resultado acumulado em 3 meses e em 1 ano (dados fictícios).',
  },
];

export type Feature = { id: string; title: string; body: string };

export const FEATURES: readonly Feature[] = [
  {
    id: 'open-finance',
    title: 'Open Finance + planilha automática',
    body: 'Conecte os bancos pelo Open Finance e o extrato já chega categorizado, sem digitar nada. Prefere não conectar? Importe o extrato ou anote na mão.',
  },
  {
    id: 'chat-whatsapp',
    title: 'Chat com IA e Tostão no WhatsApp',
    body: 'Pergunte "quanto gastei em delivery?" e receba a conta. A IA propõe o lançamento e você confirma. No WhatsApp, estamos liberando aos poucos.',
  },
  {
    id: 'automatico',
    title: 'Tostão Automático',
    body: 'Ele vigia o extrato, a previsão, os limites e os acertos, e avisa só quando importa. Você escolhe o que quer receber.',
  },
  {
    id: 'previsao',
    title: 'Previsão de 3 meses',
    body: 'Com a sua renda e as contas fixas, o Tostão estima o que deve sobrar nos próximos meses e se a sua meta cabe. É estimativa, e ele avisa que é.',
  },
  {
    id: 'acertos',
    title: 'Acertos com amigos',
    body: 'Racha de conta sem planilha: quem pagou, quem deve e quanto cada um precisa acertar.',
  },
  {
    id: 'licoes',
    title: '45 lições práticas',
    body: '9 módulos de 2 minutos, com simulador, dilema e um desafio que usa os seus números de verdade.',
  },
];

export type Plan = {
  id: 'beta' | 'completo';
  name: string;
  badge: string;
  price: string;
  note: string;
  bullets: readonly string[];
  /** Só o plano aberto tem botão: o outro ainda não existe. */
  cta: string | null;
};

export const PLANS: readonly Plan[] = [
  {
    id: 'beta',
    name: 'Beta aberto',
    badge: 'Agora',
    price: 'Grátis no lançamento',
    note: 'Tudo o que o Tostão faz hoje, sem cartão de crédito.',
    bullets: [
      'Extrato, limites, previsão, assinaturas e acertos',
      'Chat com IA e as 45 lições com simulador',
      'Com banco conectado ou só anotando na mão',
      'Sem anúncio e sem venda de dados',
    ],
    cta: 'Começar grátis',
  },
  {
    id: 'completo',
    name: 'Plano completo',
    badge: 'Em breve',
    price: 'Ainda sem preço',
    note: 'Estamos definindo. Quando existir, você fica sabendo antes e decide.',
    bullets: [
      'Nada muda no seu uso sem aviso com antecedência',
      'Seus dados continuam seus em qualquer plano',
      'Nunca vamos vender seus dados nem mostrar anúncio',
    ],
    cta: null,
  },
];

export type Faq = { id: string; question: string; answer: string; link?: { href: string; label: string } };

export const FAQ: readonly Faq[] = [
  {
    id: 'seguranca',
    question: 'É seguro conectar o meu banco?',
    answer:
      'A conexão usa o Open Finance, o sistema oficial regulado pelo Banco Central. Você autoriza no ambiente do banco, o Tostão não recebe a senha dele, o acesso é só leitura (não faz Pix, não paga conta e não mexe em nada) e você revoga quando quiser.',
  },
  {
    id: 'sem-banco',
    question: 'Dá pra usar sem conectar banco?',
    answer:
      'Dá. Você anota os gastos na mão (poucos toques), importa o extrato em arquivo e faz todas as lições. O banco conectado só poupa digitação.',
  },
  {
    id: 'ia',
    question: 'A IA enxerga os meus dados?',
    answer:
      'Só depois do seu aceite. Vai apenas o seu primeiro nome, as descrições do extrato saem mascaradas (CPF, e-mail, telefone, nome em Pix) e a IA nunca grava nada sozinha: ela propõe e você confirma. Dá pra desativar quando quiser.',
  },
  {
    id: 'cancelar',
    question: 'Como cancelo e apago os meus dados?',
    answer:
      'No Perfil você desconecta cada banco, desativa a IA e usa "Apagar minha conta", que apaga tudo, como manda a LGPD. Os detalhes estão na Política de privacidade.',
    link: { href: '/privacidade', label: 'Ler a Política de privacidade' },
  },
  {
    id: 'preco',
    question: 'Quanto custa?',
    answer:
      'Hoje é grátis, no beta aberto. Ainda não existe plano pago; quando existir, avisamos com antecedência e nada muda sem você saber.',
  },
  {
    id: 'publico',
    question: 'É só pra quem tem 20 e poucos anos?',
    answer:
      'Não. O Tostão nasceu pensando em quem está começando a lidar com dinheiro, mas serve pra qualquer pessoa que queira clareza no bolso, em qualquer fase da vida.',
  },
];

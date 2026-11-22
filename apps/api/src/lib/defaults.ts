// Categorias e regras padrão. Usadas pelo seed do Postgres e pelos repositórios em memória.
import type { Category } from '../domain/entities.js';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'delivery', name: 'Delivery', emoji: '🛵', color: '#FFE1E7', kind: 'saida' },
  { id: 'comer-fora', name: 'Comer fora', emoji: '🍔', color: '#FFF1C7', kind: 'saida' },
  { id: 'mercado', name: 'Mercado', emoji: '🛒', color: '#DDF6E8', kind: 'saida' },
  { id: 'assinaturas', name: 'Assinaturas', emoji: '📺', color: '#DCEBFF', kind: 'saida' },
  { id: 'transporte', name: 'Transporte', emoji: '🚌', color: '#FFF1C7', kind: 'saida' },
  { id: 'role', name: 'Rolê', emoji: '🍻', color: '#FFE1E7', kind: 'saida' },
  { id: 'casa', name: 'Casa e contas', emoji: '🏠', color: '#F6EFE4', kind: 'saida' },
  { id: 'saude', name: 'Saúde', emoji: '💊', color: '#DDF6E8', kind: 'saida' },
  { id: 'estudo', name: 'Estudo', emoji: '📚', color: '#DCEBFF', kind: 'saida' },
  { id: 'compras', name: 'Compras', emoji: '🛍️', color: '#FFF1C7', kind: 'saida' },
  { id: 'jogos', name: 'Jogos', emoji: '🎮', color: '#DCEBFF', kind: 'saida' },
  { id: 'apostas', name: 'Apostas', emoji: '🐯', color: '#FFE1E7', kind: 'saida' },
  { id: 'pets', name: 'Pets', emoji: '🐶', color: '#FFF1C7', kind: 'saida' },
  { id: 'beleza', name: 'Beleza e cuidados', emoji: '💇', color: '#FFE1E7', kind: 'saida' },
  { id: 'viagem', name: 'Viagem', emoji: '✈️', color: '#DCEBFF', kind: 'saida' },
  { id: 'presentes', name: 'Presentes e doações', emoji: '🎁', color: '#FFE1E7', kind: 'saida' },
  { id: 'taxas', name: 'Impostos e taxas', emoji: '🧾', color: '#F6EFE4', kind: 'saida' },
  { id: 'dividas', name: 'Dívidas e parcelas', emoji: '💳', color: '#FFF1C7', kind: 'saida' },
  // Dinheiro guardado também sai da conta; fica como saída (conta como "gasto" no resumo, ver AGENT_SYNC).
  { id: 'investimentos', name: 'Investimentos / Reserva', emoji: '🐷', color: '#DDF6E8', kind: 'saida' },
  { id: 'outros', name: 'Outros', emoji: '📦', color: '#F6EFE4', kind: 'saida' },
  { id: 'salario', name: 'Salário e renda', emoji: '💰', color: '#DDF6E8', kind: 'entrada' },
  { id: 'freela', name: 'Freela / Extra', emoji: '🧑‍💻', color: '#DCEBFF', kind: 'entrada' },
  { id: 'reembolso', name: 'Reembolso', emoji: '↩️', color: '#FFF1C7', kind: 'entrada' },
  { id: 'rendimentos', name: 'Rendimentos', emoji: '📈', color: '#DDF6E8', kind: 'entrada' },
  { id: 'entrada-outros', name: 'Outras entradas', emoji: '📥', color: '#DDF6E8', kind: 'entrada' },
  { id: 'nao-conta', name: 'Não conta', emoji: '🙈', color: '#F6EFE4', kind: 'neutra' },
];

// Padrões em MAIÚSCULAS e sem acento (ver normalizeDescription)
export const DEFAULT_RULES: { pattern: string; categoryId: string }[] = [
  ...['IFD*', 'IFOOD', 'RAPPI', 'ZE DELIVERY', 'AIQFOME'].map((p) => ({ pattern: p, categoryId: 'delivery' })),
  ...[
    'SPOTIFY',
    'NETFLIX',
    'DISNEY',
    'PRIME VIDEO',
    'AMAZONPRIME',
    'HBO',
    'MAX.COM',
    'YOUTUBE',
    'GLOBOPLAY',
    'DEEZER',
    'APPLE.COM/BILL',
  ].map((p) => ({ pattern: p, categoryId: 'assinaturas' })),
  ...['UBER', '99APP', '99 TAXI', '99POP', 'BILHETE UNICO', 'METRO', 'POSTO ', 'SHELL', 'IPIRANGA'].map((p) => ({
    pattern: p,
    categoryId: 'transporte',
  })),
  ...['ASSAI', 'ATACADAO', 'CARREFOUR', 'PAO DE ACUCAR', 'SUPERMERC', 'HORTIFRUTI', 'OXXO'].map((p) => ({
    pattern: p,
    categoryId: 'mercado',
  })),
  // Sem palavras que aparecem em pedido de app (PIZZARIA, BURGER...): aí é Delivery.
  ...['PADARIA', 'PANIFICADORA', 'LANCHONETE', 'PASTELARIA', 'CANTINA', 'CAFETERIA', 'STARBUCKS', 'SUBWAY'].map(
    (p) => ({ pattern: p, categoryId: 'comer-fora' }),
  ),
  ...['DROGASIL', 'DROGA RAIA', 'PAGUE MENOS', 'FARMACIA', 'DROGARIA'].map((p) => ({
    pattern: p,
    categoryId: 'saude',
  })),
  ...[
    'STEAM',
    'STEAMGAMES',
    'PLAYSTATION',
    'PSN',
    'XBOX',
    'NINTENDO',
    'EPIC GAMES',
    'RIOT GAMES',
    'GARENA',
    'BLIZZARD',
    'ROBLOX',
    'NUUVEM',
  ].map((p) => ({ pattern: p, categoryId: 'jogos' })),
  ...['BET365', 'BLAZE', 'PIXBET', 'ESTRELABET', 'SPORTINGBET', 'BETANO', 'TIGRINHO'].map((p) => ({
    pattern: p,
    categoryId: 'apostas',
  })),
  ...['SHOPEE', 'SHEIN', 'MERCADOLIVRE', 'MERCADO LIVRE', 'AMAZON', 'ALIEXPRESS', 'MAGALU'].map((p) => ({
    pattern: p,
    categoryId: 'compras',
  })),
  ...['UDEMY', 'ALURA', 'ROCKETSEAT', 'COURSERA'].map((p) => ({ pattern: p, categoryId: 'estudo' })),
  ...['ENEL', 'SABESP', 'CLARO', 'VIVO', 'TIM ', 'ALUGUEL', 'CONDOMINIO'].map((p) => ({
    pattern: p,
    categoryId: 'casa',
  })),
  ...['SALARIO', 'FOLHA PAG', 'PROVENTOS', 'TRANSF SALDO C/SAL'].map((p) => ({ pattern: p, categoryId: 'salario' })),
  // Categorias extras. Padrões longos de propósito: a regra é "contém", então "PET" solto pegaria "PETROBRAS".
  ...['PETZ', 'COBASI', 'PETLOVE', 'PETSHOP', 'PET SHOP', 'VETERINARI'].map((p) => ({
    pattern: p,
    categoryId: 'pets',
  })),
  ...[
    'BARBEARIA',
    'BARBER',
    'SALAO DE BELEZA',
    'CABELEIREIR',
    'MANICURE',
    'O BOTICARIO',
    'NATURA COSMETICOS',
    'SEPHORA',
    'BELEZA NA WEB',
  ].map((p) => ({ pattern: p, categoryId: 'beleza' })),
  ...['BUSER', 'CLICKBUS', 'DECOLAR', 'LATAM AIR', 'GOL LINHAS', 'AZUL LINHAS', 'AIRBNB', 'BOOKING.COM', 'HOTEL '].map(
    (p) => ({ pattern: p, categoryId: 'viagem' }),
  ),
  ...['VAKINHA', 'VAQUINHA', 'KATARSE', 'DOACAO'].map((p) => ({ pattern: p, categoryId: 'presentes' })),
  ...[
    'DARF',
    'IPVA',
    'IPTU',
    'DETRAN',
    'LICENCIAMENTO',
    'TARIFA BANCARIA',
    'ANUIDADE',
    'IOF COMPRA',
    'IOF SOBRE',
    'IOF INTERNACIONAL',
  ].map((p) => ({
    pattern: p,
    categoryId: 'taxas',
  })),
  ...['EMPRESTIMO', 'FINANCIAMENTO'].map((p) => ({ pattern: p, categoryId: 'dividas' })),
  ...['TESOURO DIRETO', 'CDB ', 'RESERVA DE EMERGENCIA', 'CAIXINHA', 'COFRINHO', 'APLICACAO RDB'].map((p) => ({
    pattern: p,
    categoryId: 'investimentos',
  })),
  ...['FREELA', 'FREELANCE', 'WORKANA', '99FREELAS'].map((p) => ({ pattern: p, categoryId: 'freela' })),
  ...['ESTORNO', 'REEMBOLSO', 'DEVOLUCAO'].map((p) => ({ pattern: p, categoryId: 'reembolso' })),
  ...['RENDIMENTO', 'REND PAGO', 'JUROS S/CAPITAL', 'DIVIDENDO', 'JCP'].map((p) => ({
    pattern: p,
    categoryId: 'rendimentos',
  })),
];

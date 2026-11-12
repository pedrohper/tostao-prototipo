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
  { id: 'apostas', name: 'Apostas', emoji: '🐯', color: '#FFE1E7', kind: 'saida' },
  { id: 'outros', name: 'Outros', emoji: '📦', color: '#F6EFE4', kind: 'saida' },
  { id: 'salario', name: 'Salário e renda', emoji: '💰', color: '#DDF6E8', kind: 'entrada' },
  { id: 'entrada-outros', name: 'Outras entradas', emoji: '📥', color: '#DDF6E8', kind: 'entrada' },
];

// Padrões em MAIÚSCULAS e sem acento (ver normalizeDescription)
export const DEFAULT_RULES: { pattern: string; categoryId: string }[] = [
  ...['IFD*', 'IFOOD', 'RAPPI', 'ZE DELIVERY', 'AIQFOME'].map((p) => ({ pattern: p, categoryId: 'delivery' })),
  ...['SPOTIFY', 'NETFLIX', 'DISNEY', 'PRIME VIDEO', 'AMAZONPRIME', 'HBO', 'MAX.COM', 'YOUTUBE', 'GLOBOPLAY', 'DEEZER', 'APPLE.COM/BILL']
    .map((p) => ({ pattern: p, categoryId: 'assinaturas' })),
  ...['UBER', '99APP', '99 TAXI', '99POP', 'BILHETE UNICO', 'METRO', 'POSTO ', 'SHELL', 'IPIRANGA']
    .map((p) => ({ pattern: p, categoryId: 'transporte' })),
  ...['ASSAI', 'ATACADAO', 'CARREFOUR', 'PAO DE ACUCAR', 'SUPERMERC', 'HORTIFRUTI', 'OXXO']
    .map((p) => ({ pattern: p, categoryId: 'mercado' })),
  // Sem palavras que aparecem em pedido de app (PIZZARIA, BURGER...): aí é Delivery.
  ...['PADARIA', 'PANIFICADORA', 'LANCHONETE', 'PASTELARIA', 'CANTINA', 'CAFETERIA', 'STARBUCKS', 'SUBWAY'].map((p) => ({ pattern: p, categoryId: 'comer-fora' })),
  ...['DROGASIL', 'DROGA RAIA', 'PAGUE MENOS', 'FARMACIA', 'DROGARIA'].map((p) => ({ pattern: p, categoryId: 'saude' })),
  ...['BET365', 'BLAZE', 'PIXBET', 'ESTRELABET', 'SPORTINGBET', 'BETANO', 'TIGRINHO'].map((p) => ({ pattern: p, categoryId: 'apostas' })),
  ...['SHOPEE', 'SHEIN', 'MERCADOLIVRE', 'MERCADO LIVRE', 'AMAZON', 'ALIEXPRESS', 'MAGALU'].map((p) => ({ pattern: p, categoryId: 'compras' })),
  ...['UDEMY', 'ALURA', 'ROCKETSEAT', 'COURSERA'].map((p) => ({ pattern: p, categoryId: 'estudo' })),
  ...['ENEL', 'SABESP', 'CLARO', 'VIVO', 'TIM ', 'ALUGUEL', 'CONDOMINIO'].map((p) => ({ pattern: p, categoryId: 'casa' })),
  ...['SALARIO', 'FOLHA PAG', 'PROVENTOS'].map((p) => ({ pattern: p, categoryId: 'salario' })),
];

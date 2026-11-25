// Mascara dado pessoal ANTES de qualquer texto do extrato sair pro provedor de IA (LGPD: minimização).
// Funções puras, sem I/O. Regra de ouro: na dúvida, mascara. O modelo precisa do "tipo" da transação
// (PIX ENVIADO, IFOOD, UBER), nunca de quem é a pessoa nem dos documentos dela.

// Lookarounds em vez de \b: documento colado em outro número não pode escapar da máscara.
const CNPJ = /(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g;
const CPF = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
// Telefone BR: +55 opcional, DDD (com ou sem parênteses), 8 ou 9 dígitos. Exige separador ou parênteses/+55
// pra não comer data (2026-11-10), valor ou parcela.
const PHONE = /(?<![\d/])(?:\+?55[\s.-]?)?(?:\(\d{2}\)\s?|\d{2}[\s.-])9?\d{4}[\s.-]?\d{4}(?![\d/])/g;
// Cartão com espaços/traços: 4 grupos de 4 (o último pode ser curto: 13 a 19 dígitos).
const CARD_SPACED = /(?<!\d)(?:\d{4}[ -]){3}\d{1,7}(?!\d)/g;
const LONG_NUMBER = /(?<!\d)\d{6,}(?!\d)/g; // conta, agência, cartão corrido, protocolo...

const TRANSFER_PREFIX =
  /\b(PIX(?:\s+(?:ENVIAD[OA]|RECEBID[OA]|TRANSF(?:ERENCIA)?|QR\s*CODE))?|TED(?:\s+(?:ENVIAD[OA]|RECEBID[OA]))?|DOC(?:\s+(?:ENVIAD[OA]|RECEBID[OA]))?|TRANSF(?:ERENCIA|\.)?(?:\s+(?:ENVIAD[OA]|RECEBID[OA]|PIX|TED|DOC))?)\b[\s:*-]+/i;

// Se o "nome" depois do prefixo tem cara de empresa, a empresa é o que o modelo precisa pra categorizar.
const BUSINESS =
  /\b(LTDA|EIRELI|EPP|MEI|S\.?\/?A\.?|CIA|ME|SERVICOS?|COMERCIO|LOJAS?|MERCADO|SUPERMERCADOS?|FARMACIAS?|DROGARIAS?|RESTAURANTES?|PADARIA|LANCHONETE|POSTO|IFOOD|UBER|99|RAPPI|NETFLIX|SPOTIFY|AMAZON|MERCADO\s*LIVRE|SHOPEE|MAGALU|BANCO|ASSOCIACAO|IGREJA|CLINICA|HOSPITAL|ESCOLA|FACULDADE|UNIVERSIDADE|CONDOMINIO|PREFEITURA|GOVERNO|RECEITA|INSS)\b/i;

// Palavras que aparecem depois do prefixo mas não são nome de pessoa.
const GENERIC = new Set(
  'ENVIADO ENVIADA RECEBIDO RECEBIDA CONTA AG AGENCIA CHAVE QR CODE QRCODE REF PAGTO PAGAMENTO DE DA DO DAS DOS E'.split(
    ' ',
  ),
);

/** Sobrou algum nome próprio (palavra com letras que não é palavra de sistema nem token já mascarado)? */
function hasNameWords(rest: string) {
  const words = rest.replace(/\[[A-Z]+\]/g, ' ').match(/\p{L}{2,}/gu) ?? [];
  return words.some((w) => !GENERIC.has(stripAccents(w).toUpperCase()));
}

const MAX_LEN = 120;

/** Texto limpo pra ir no prompt: sem quebra de linha, controle nem "<" ">" (não deixa fechar o bloco de dados). */
function tidy(text: string) {
  return (
    text
      // eslint-disable-next-line no-control-regex -- remover caractere de controle é justamente o objetivo
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/[<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_LEN)
  );
}

function stripAccents(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Documentos, contatos e números de conta/cartão viram marcadores. A ordem importa: do mais específico ao genérico. */
function maskIdentifiers(text: string) {
  return text
    .replace(CNPJ, '[CNPJ]')
    .replace(CPF, '[CPF]')
    .replace(UUID, '[ID]')
    .replace(EMAIL, '[EMAIL]')
    .replace(CARD_SPACED, '[ID]')
    .replace(PHONE, '[TEL]')
    .replace(LONG_NUMBER, '[ID]');
}

/** Descrição de extrato -> texto seguro pra IA. Idempotente. */
export function scrubFinancialText(text: string): string {
  let out = maskIdentifiers(tidy(text));

  // "PIX ENVIADO JOAO DA SILVA" -> "PIX ENVIADO [PESSOA]" (mantém só o tipo da transferência).
  const m = TRANSFER_PREFIX.exec(out);
  if (m) {
    const rest = out.slice(m.index + m[0].length).trim();
    if (rest && !rest.startsWith('[PESSOA]') && hasNameWords(rest) && !BUSINESS.test(stripAccents(rest))) {
      out = `${out.slice(0, m.index)}${m[1]!.trim()} [PESSOA]`;
    }
  }
  return out;
}

/** Largura zero, controle de direção e BOM: servem pra esconder texto ou furar a máscara. */
const INVISIBLE = /[\u00ad\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;
const NAME_PARTICLES = new Set(['das', 'dos', 'del']);
const foldName = (s: string) => stripAccents(s).toLowerCase();

/**
 * Mensagem de um desconhecido colada pela pessoa ("Isso é golpe?") -> texto seguro pra IA. Mesmas máscaras do extrato,
 * mas sem cortar em uma linha, e escondendo o nome de quem colou (golpe costuma chamar a vítima pelo nome).
 * Nomes de terceiros não têm como ser reconhecidos com segurança num texto livre. Link fica: é o principal sinal.
 */
export function scrubPastedMessage(text: string, ownName?: string | null, max = 2000): string {
  const clean = text
    .normalize('NFKC') // dígito "largo" vira dígito comum, senão o CPF escapa
    .replace(INVISIBLE, '')
    // eslint-disable-next-line no-control-regex -- remover caractere de controle (menos a quebra de linha) é o objetivo
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ')
    .replace(/[<>]/g, ' ') // não deixa fechar o bloco delimitado do prompt
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n[ \n]*/g, '\n')
    .trim()
    .slice(0, max);
  const own = new Set(
    (ownName ?? '')
      .split(/\s+/)
      .map(foldName)
      .filter((part) => part.length >= 3 && !NAME_PARTICLES.has(part)),
  );
  const masked = maskIdentifiers(clean);
  return own.size ? masked.replace(/\p{L}+/gu, (word) => (own.has(foldName(word)) ? '[NOME]' : word)) : masked;
}

/** Só o primeiro nome vai pra IA ("Pedro Henrique Pereira" -> "Pedro"). */
export function firstName(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  return tidy(first).slice(0, 30);
}

/**
 * Pix/TED/DOC "puro" pra uma pessoa ("PIX ENVIADO JOAO DA SILVA"): não dá pra categorizar, então nem manda
 * pra IA (economiza token e não expõe o nome). Pix pra empresa ou com contexto (ex.: "PIX IFOOD") passa.
 */
export function isPersonalTransfer(description: string): boolean {
  const m = TRANSFER_PREFIX.exec(tidy(description));
  if (!m) return false;
  const rest = tidy(description)
    .slice(m.index + m[0].length)
    .trim();
  if (!rest) return false;
  if (BUSINESS.test(stripAccents(rest)) || !hasNameWords(rest)) return false;
  // Só palavras (nome), sem dígitos: "JOAO DA SILVA", "MARIA J. SOUZA".
  return /^[\p{L}][\p{L}.' -]*$/u.test(rest) && !/\d/.test(rest);
}

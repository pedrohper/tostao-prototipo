/**
 * Logos e selos de bancos e bandeiras de cartão.
 * Prioriza logos oficiais do gateway quando disponíveis; caso contrário usa marcas vetoriais locais.
 */
import type { BankLogo } from '@/lib/api-queries';

type Visual = { sigla: string; bg: string; fg: string; brand?: BankBrandKey };
export type { BankLogo };

type BankBrandKey =
  | 'nubank'
  | 'mercadopago'
  | 'bradesco'
  | 'itau'
  | 'inter'
  | 'bb'
  | 'caixa'
  | 'santander'
  | 'c6'
  | 'picpay'
  | 'pagbank'
  | 'neon'
  | 'next'
  | 'will'
  | 'btg'
  | 'xp'
  | 'sicoob'
  | 'sicredi'
  | 'banrisul'
  | 'original'
  | 'amazon';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const temPalavra = (texto: string, termo: string) => ` ${texto} `.includes(` ${termo} `);
const GENERICAS = new Set(['banco', 'conta', 'cartao', 'credito', 'bank', 'pay', 'digital', 'empresas', 'previdencia']);
const ALIASES: [RegExp, RegExp][] = [
  [/\bxp\b/, /\bxp\b/],
  [/\bc6\b/, /\bc6\b/],
  [/\bbb\b/, /^banco do brasil$/],
  [/\bbtg\b/, /^btg\s*pactual$/],
  [/\bnu\b/, /^nubank$/],
];

/** Acha o logo pelo nome da conta: primeiro o nome inteiro do banco, depois a primeira palavra forte (ex.: "Caixa") e siglas comuns. */
export function findBankLogo(logos: BankLogo[], ...nomes: (string | null | undefined)[]): BankLogo | null {
  const texto = norm(nomes.filter(Boolean).join(' '));
  if (!texto || logos.length === 0) return null;
  const textoCompacto = texto.replace(/\s+/g, '');
  let melhor: BankLogo | null = null;
  let tam = 0;
  for (const l of logos) {
    const n = norm(l.name);
    if (n.length > tam && (temPalavra(texto, n) || (n.length >= 4 && textoCompacto.includes(n.replace(/\s+/g, ''))))) {
      melhor = l;
      tam = n.length;
    }
  }
  if (melhor) return melhor;
  for (const [textRe, logoRe] of ALIASES) {
    if (!textRe.test(texto)) continue;
    const hit = logos.find((l) => logoRe.test(norm(l.name)));
    if (hit) return hit;
  }
  const porPalavra = logos
    .map((l) => ({ l, palavras: norm(l.name).split(' ') }))
    .filter(
      ({ palavras }) =>
        palavras[0] && palavras[0].length >= 4 && !GENERICAS.has(palavras[0]) && temPalavra(texto, palavras[0]),
    )
    .sort((a, b) => a.palavras.length - b.palavras.length);
  return porPalavra[0]?.l ?? null;
}

const BANCOS: [RegExp, Visual][] = [
  [/amazon/i, { sigla: 'a', bg: '#232F3E', fg: '#FFFFFF', brand: 'amazon' }],
  [/nubank|\bnu\b/i, { sigla: 'nu', bg: '#820AD1', fg: '#FFFFFF', brand: 'nubank' }],
  [/mercado ?pago/i, { sigla: 'mp', bg: '#009EE3', fg: '#FFFFFF', brand: 'mercadopago' }],
  [/bradesc/i, { sigla: 'B', bg: '#CC092F', fg: '#FFFFFF', brand: 'bradesco' }],
  [/ita[uú]/i, { sigla: 'it', bg: '#EC7000', fg: '#FFFFFF', brand: 'itau' }],
  [/\binter\b/i, { sigla: 'in', bg: '#FF7A00', fg: '#FFFFFF', brand: 'inter' }],
  [/banco do brasil|\bbb\b/i, { sigla: 'BB', bg: '#FCF800', fg: '#0038A8', brand: 'bb' }],
  [/caixa/i, { sigla: 'cx', bg: '#005CA9', fg: '#FFFFFF', brand: 'caixa' }],
  [/santander/i, { sigla: 'S', bg: '#EC0000', fg: '#FFFFFF', brand: 'santander' }],
  [/\bc6\b/i, { sigla: 'C6', bg: '#1E1B18', fg: '#FFFFFF', brand: 'c6' }],
  [/picpay/i, { sigla: 'pp', bg: '#21C25E', fg: '#FFFFFF', brand: 'picpay' }],
  [/pagbank|pagseguro/i, { sigla: 'pg', bg: '#1BB99A', fg: '#FFFFFF', brand: 'pagbank' }],
  [/neon/i, { sigla: 'ne', bg: '#0090FF', fg: '#FFFFFF', brand: 'neon' }],
  [/\bnext\b/i, { sigla: 'nx', bg: '#00E05A', fg: '#1E1B18', brand: 'next' }],
  [/will ?bank/i, { sigla: 'w', bg: '#FFE000', fg: '#1E1B18', brand: 'will' }],
  [/btg/i, { sigla: 'btg', bg: '#0E2A47', fg: '#FFFFFF', brand: 'btg' }],
  [/\bxp\b/i, { sigla: 'XP', bg: '#1E1B18', fg: '#FFC233', brand: 'xp' }],
  [/sicoob/i, { sigla: 'sc', bg: '#003641', fg: '#7DB61C', brand: 'sicoob' }],
  [/sicredi/i, { sigla: 'sc', bg: '#33820D', fg: '#FFFFFF', brand: 'sicredi' }],
  [/banrisul/i, { sigla: 'br', bg: '#004B8D', fg: '#FFFFFF', brand: 'banrisul' }],
  [/original/i, { sigla: 'o', bg: '#00A857', fg: '#FFFFFF', brand: 'original' }],
];

const RESERVA = ['var(--color-laranja)', 'var(--color-menta)', '#7A5AF8', '#2E90FA', 'var(--color-amarelo)'];

export function getBankVisual(...nomes: (string | null | undefined)[]): Visual & { conhecido: boolean } {
  const texto = nomes.filter(Boolean).join(' ');
  for (const [re, v] of BANCOS) if (re.test(texto)) return { ...v, conhecido: true };
  const base = (nomes.find(Boolean) ?? '?').trim();
  const cor = RESERVA[[...base].reduce((s, c) => s + c.charCodeAt(0), 0) % RESERVA.length];
  return {
    sigla: base.charAt(0).toUpperCase() || '?',
    bg: cor,
    fg: cor === 'var(--color-amarelo)' || cor === 'var(--color-menta)' ? 'var(--color-tinta-fixa)' : '#FFFFFF',
    conhecido: false,
  };
}

function BrandMarkSvg({ brand }: { brand: BankBrandKey }) {
  switch (brand) {
    case 'nubank':
      return (
        <svg viewBox="0 0 32 32" className="h-[68%] w-[68%]" fill="none" aria-hidden="true">
          <path
            d="M7 22V12.5a3.5 3.5 0 0 1 7 0V22M18 10v9.5a3.5 3.5 0 0 0 7 0V10"
            stroke="#FFFFFF"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'bradesco':
      return (
        <svg viewBox="0 0 32 32" className="h-[68%] w-[68%]" fill="none" aria-hidden="true">
          <path d="M6.5 21.5c3.2-5 11.8-6.4 18.5-2.3" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M9.5 24c2.8-3.6 9.5-4.6 14.5-1.5" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M16 14.5V8M16 14.5l-4-3.5M16 14.5l4-3.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'mercadopago':
      return (
        <svg viewBox="0 0 32 32" className="h-[72%] w-[72%]" fill="none" aria-hidden="true">
          <ellipse cx="16" cy="16" rx="11" ry="7.8" stroke="#FFFFFF" strokeWidth="2.2" />
          <path
            d="M9.5 16.2c2-2.1 4.2-2.1 6.5 0 2.3-2.1 4.5-2.1 6.5 0"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'amazon':
      return (
        <svg viewBox="0 0 32 32" className="h-[70%] w-[70%]" fill="none" aria-hidden="true">
          <path
            d="M12.2 17.6c0-2.5 1.7-4 4.2-4 1.2 0 2.1.3 2.8.8v3.6c0 1 .1 1.6.6 2.1"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="15.8" cy="17.2" r="2.6" stroke="#FFFFFF" strokeWidth="2.2" />
          <path
            d="M7.5 22.8c4.8 3.1 12.2 3.1 17 0M22.5 21.3l2.6 1.2-.9 2.5"
            stroke="#FF9900"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'itau':
      return (
        <svg viewBox="0 0 32 32" className="h-[68%] w-[68%]" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="24" height="24" rx="6" fill="#003399" />
          <circle cx="11.5" cy="11.2" r="1.7" fill="#FFFF00" />
          <path d="M11.5 14.5v7M17 11.5v8.5c0 1.4.8 2 2.2 2" stroke="#FFFF00" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M15 15h4.4" stroke="#FFFF00" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'bb':
      return (
        <svg viewBox="0 0 32 32" className="h-[68%] w-[68%]" fill="none" aria-hidden="true">
          <path
            d="M16 5.5L25.5 12 16 18.5 6.5 12 16 5.5ZM16 13.5L25.5 20 16 26.5 6.5 20 16 13.5Z"
            stroke="#0038A8"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'caixa':
      return (
        <svg viewBox="0 0 32 32" className="h-[68%] w-[68%]" fill="none" aria-hidden="true">
          <path d="M8.5 8.5L23.5 23.5" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M23.5 8.5L8.5 23.5" stroke="#F39200" strokeWidth="3.4" strokeLinecap="round" />
        </svg>
      );
    case 'santander':
      return (
        <svg viewBox="0 0 32 32" className="h-[68%] w-[68%]" fill="none" aria-hidden="true">
          <path
            d="M16 6.5c0 3.2-3 4.8-3 7.4 0 1.7 1.3 2.9 3 2.9s3-1.2 3-2.9c0-1.2-.5-2.1-1-2.9"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M8.2 21.8c0 2.6 3.5 4.2 7.8 4.2s7.8-1.6 7.8-4.2c0-2-2.2-3.3-4.6-3.8"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'inter':
      return (
        <svg viewBox="0 0 32 32" className="h-[66%] w-[66%]" fill="none" aria-hidden="true">
          <circle cx="11" cy="10" r="1.9" fill="#FFFFFF" />
          <path
            d="M11 14.2v8.3M16.5 22.5v-5.6a3.5 3.5 0 0 1 7 0v5.6"
            stroke="#FFFFFF"
            strokeWidth="2.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'c6':
      return (
        <svg viewBox="0 0 32 32" className="h-[66%] w-[66%]" fill="none" aria-hidden="true">
          <path d="M14.5 11.2a5.2 5.2 0 1 0 0 9.6" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="20.8" cy="18.2" r="3.4" stroke="#FFFFFF" strokeWidth="2.3" />
          <path d="M17.6 17.5c.3-3.4 2.3-5.8 5.4-6.3" stroke="#FFFFFF" strokeWidth="2.3" strokeLinecap="round" />
        </svg>
      );
    case 'picpay':
      return (
        <svg viewBox="0 0 32 32" className="h-[66%] w-[66%]" fill="none" aria-hidden="true">
          <path
            d="M9.5 23V11.5h4.2a3.3 3.3 0 0 1 0 6.6H9.5M19 23V11.5h4.2a3.3 3.3 0 0 1 0 6.6H19"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'sicoob':
    case 'sicredi':
      return (
        <svg viewBox="0 0 32 32" className="h-[66%] w-[66%]" fill="none" aria-hidden="true">
          <path
            d="M16 6.5l8 5.2v8.6L16 25.5l-8-5.2v-8.6L16 6.5Z"
            stroke="#FFFFFF"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path
            d="M11.5 16l3.2 3.2 5.8-6"
            stroke="#A4D65E"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function BankBadge({
  nome,
  instituicao,
  size = 20,
  quadrado = false,
  logos = [],
}: {
  nome: string;
  instituicao?: string | null;
  size?: number;
  quadrado?: boolean;
  logos?: BankLogo[];
}) {
  const logo = findBankLogo(logos, nome, instituicao);
  if (logo) {
    return (
      <img
        src={logo.imageUrl}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={`shrink-0 bg-white object-contain ring-1 ring-black/5 dark:ring-white/10 ${quadrado ? 'rounded-[30%]' : 'rounded-full'}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const v = getBankVisual(instituicao, nome);
  const fonte = Math.round(size * (v.sigla.length >= 3 ? 0.34 : v.sigla.length === 2 ? 0.42 : 0.52));
  const mark = v.brand ? <BrandMarkSvg brand={v.brand} /> : null;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-display leading-none font-extrabold ring-1 ring-black/5 dark:ring-white/10 ${quadrado ? 'rounded-[30%]' : 'rounded-full'}`}
      style={{ width: size, height: size, background: v.bg, color: v.fg, fontSize: fonte, letterSpacing: '-0.02em' }}
    >
      {mark ?? v.sigla}
    </span>
  );
}

const BANDEIRAS: Record<string, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Master',
  MASTER: 'Master',
  ELO: 'Elo',
  AMEX: 'Amex',
  'AMERICAN EXPRESS': 'Amex',
  HIPERCARD: 'Hiper',
  HIPER: 'Hiper',
  DINERS: 'Diners',
};

export const getCardNetworkName = (brand: string | null | undefined) =>
  brand ? (BANDEIRAS[brand.toUpperCase()] ?? brand.charAt(0) + brand.slice(1).toLowerCase()) : null;

function CardNetworkLogo({ brand }: { brand: string }) {
  const key = brand.toUpperCase();
  if (key === 'MASTERCARD' || key === 'MASTER') {
    return (
      <svg width="20" height="13" viewBox="0 0 24 15" fill="none" aria-hidden="true">
        <circle cx="8.5" cy="7.5" r="6" fill="#EB001B" />
        <circle cx="15.5" cy="7.5" r="6" fill="#F79E1B" fillOpacity="0.88" />
      </svg>
    );
  }
  if (key === 'VISA') {
    return (
      <span className="rounded-[4px] bg-[#1A1F71] px-1.5 py-[1px] text-[9px] font-black tracking-[0.06em] text-white italic">
        VISA
      </span>
    );
  }
  if (key === 'ELO') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#1E1B18] px-1.5 py-[1px] text-[9px] font-extrabold text-white">
        <span className="inline-flex gap-[1.5px]">
          <i className="h-1.5 w-1.5 rounded-full bg-[#FFCB05]" />
          <i className="h-1.5 w-1.5 rounded-full bg-[#00A4E0]" />
          <i className="h-1.5 w-1.5 rounded-full bg-[#EF4123]" />
        </span>
        elo
      </span>
    );
  }
  if (key === 'AMEX' || key === 'AMERICAN EXPRESS') {
    return (
      <span className="rounded-[4px] bg-[#006FCF] px-1.5 py-[1px] text-[9px] font-extrabold tracking-[0.04em] text-white">
        AMEX
      </span>
    );
  }
  if (key === 'HIPERCARD' || key === 'HIPER') {
    return (
      <span className="rounded-[4px] bg-[#B3131B] px-1.5 py-[1px] text-[9px] font-extrabold tracking-[0.03em] text-white">
        HIPER
      </span>
    );
  }
  return (
    <span className="rounded-[5px] border border-linha bg-cartao px-1.5 py-px text-[10px] font-extrabold tracking-[0.04em] text-tinta uppercase">
      {getCardNetworkName(brand)}
    </span>
  );
}

/** Bandeira do cartão + final ("•• 2784"). */
export function CardNetworkBadge({
  brand,
  last4,
  className = '',
}: {
  brand?: string | null;
  last4?: string | null;
  className?: string;
}) {
  const nome = getCardNetworkName(brand);
  if (!nome && !last4) return null;
  return (
    <span
      aria-label={[nome, last4 ? `final ${last4}` : null].filter(Boolean).join(' ')}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-tinta-suave ${className}`}
    >
      {brand && <CardNetworkLogo brand={brand} />}
      {last4 && <span className="tabular-nums">•• {last4}</span>}
    </span>
  );
}

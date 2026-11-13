/**
 * Selo do banco: a inicial na cor do banco, sem usar o logo de ninguém.
 * O Pluggy (via Meu Pluggy) não manda logo, então a gente reconhece pelo nome.
 */
type Visual = { sigla: string; bg: string; fg: string };

const BANCOS: [RegExp, Visual][] = [
  [/nubank|\bnu\b/i, { sigla: 'nu', bg: '#820AD1', fg: '#FFFFFF' }],
  [/mercado ?pago/i, { sigla: 'mp', bg: '#00B1EA', fg: '#FFFFFF' }],
  [/bradesc/i, { sigla: 'B', bg: '#CC092F', fg: '#FFFFFF' }],
  [/ita[uú]/i, { sigla: 'it', bg: '#EC7000', fg: '#FFFFFF' }],
  [/\binter\b/i, { sigla: 'in', bg: '#FF7A00', fg: '#FFFFFF' }],
  [/banco do brasil|\bbb\b/i, { sigla: 'BB', bg: '#FCF800', fg: '#0038A8' }],
  [/caixa/i, { sigla: 'cx', bg: '#005CA9', fg: '#FFFFFF' }],
  [/santander/i, { sigla: 'S', bg: '#EC0000', fg: '#FFFFFF' }],
  [/\bc6\b/i, { sigla: 'C6', bg: '#1E1B18', fg: '#FFFFFF' }],
  [/picpay/i, { sigla: 'pp', bg: '#21C25E', fg: '#FFFFFF' }],
  [/pagbank|pagseguro/i, { sigla: 'pg', bg: '#1BB99A', fg: '#FFFFFF' }],
  [/neon/i, { sigla: 'ne', bg: '#0090FF', fg: '#FFFFFF' }],
  [/\bnext\b/i, { sigla: 'nx', bg: '#00E05A', fg: '#1E1B18' }],
  [/will ?bank/i, { sigla: 'w', bg: '#FFE000', fg: '#1E1B18' }],
  [/btg/i, { sigla: 'btg', bg: '#0E2A47', fg: '#FFFFFF' }],
  [/\bxp\b/i, { sigla: 'XP', bg: '#1E1B18', fg: '#FFC233' }],
  [/sicoob/i, { sigla: 'sc', bg: '#003641', fg: '#7DB61C' }],
  [/sicredi/i, { sigla: 'sc', bg: '#33820D', fg: '#FFFFFF' }],
  [/banrisul/i, { sigla: 'br', bg: '#004B8D', fg: '#FFFFFF' }],
  [/original/i, { sigla: 'o', bg: '#00A857', fg: '#FFFFFF' }],
  [/amazon/i, { sigla: 'a', bg: '#232F3E', fg: '#FF9900' }],
];

const RESERVA = ['#FF5A36', '#3DD6A0', '#7A5AF8', '#2E90FA', '#FFC233'];

export function visualDoBanco(...nomes: (string | null | undefined)[]): Visual & { conhecido: boolean } {
  const texto = nomes.filter(Boolean).join(' ');
  for (const [re, v] of BANCOS) if (re.test(texto)) return { ...v, conhecido: true };
  const base = (nomes.find(Boolean) ?? '?').trim();
  const cor = RESERVA[[...base].reduce((s, c) => s + c.charCodeAt(0), 0) % RESERVA.length];
  return { sigla: base.charAt(0).toUpperCase() || '?', bg: cor, fg: cor === '#FFC233' || cor === '#3DD6A0' ? '#1E1B18' : '#FFFFFF', conhecido: false };
}

export function SeloBanco({ nome, instituicao, size = 20, quadrado = false }: { nome: string; instituicao?: string | null; size?: number; quadrado?: boolean }) {
  const v = visualDoBanco(instituicao, nome);
  const fonte = Math.round(size * (v.sigla.length >= 3 ? 0.34 : v.sigla.length === 2 ? 0.42 : 0.52));
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center font-display leading-none font-extrabold ring-1 ring-black/5 dark:ring-white/10 ${quadrado ? 'rounded-[30%]' : 'rounded-full'}`}
      style={{ width: size, height: size, background: v.bg, color: v.fg, fontSize: fonte, letterSpacing: '-0.02em' }}>
      {v.sigla}
    </span>
  );
}

const BANDEIRAS: Record<string, string> = {
  VISA: 'Visa', MASTERCARD: 'Master', MASTER: 'Master', ELO: 'Elo', AMEX: 'Amex', 'AMERICAN EXPRESS': 'Amex', HIPERCARD: 'Hiper', HIPER: 'Hiper', DINERS: 'Diners',
};

export const nomeBandeira = (brand: string | null | undefined) => (brand ? BANDEIRAS[brand.toUpperCase()] ?? brand.charAt(0) + brand.slice(1).toLowerCase() : null);

/** "Visa •• 2784": bandeira em etiqueta + final do cartão. */
export function Bandeira({ brand, last4, className = '' }: { brand?: string | null; last4?: string | null; className?: string }) {
  const nome = nomeBandeira(brand);
  if (!nome && !last4) return null;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-tinta-suave ${className}`}>
      {nome && <span className="rounded-[5px] border border-linha bg-cartao px-1.5 py-px text-[10px] font-extrabold tracking-[0.04em] text-tinta uppercase">{nome}</span>}
      {last4 && <span className="tabular-nums">•• {last4}</span>}
    </span>
  );
}

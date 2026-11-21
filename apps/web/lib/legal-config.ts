// Dados de quem opera o Tostão (contato, encarregado LGPD, razão social, CNPJ) que aparecem nos textos legais, no
// rodapé de suporte e nas telas de erro. Vêm de variáveis NEXT_PUBLIC_* (lidas no `pnpm build`), NUNCA escritas no código:
// trocar de responsável/CNPJ não pode exigir mexer em Termos e Privacidade.
//
// Fallback seguro: sem variável, não inventamos e-mail nem CNPJ. O e-mail some (a tela mostra o texto genérico) e a
// razão social vira só "Tostão". Preencher tudo é pré-requisito pra abrir o app pra mais gente (ver .env.example).

export type LegalConfig = {
  /** E-mail de suporte. null = não configurado. */
  supportEmail: string | null;
  /** E-mail do encarregado de dados (DPO, LGPD art. 41). Cai pro de suporte se não houver. */
  dpoEmail: string | null;
  /** Razão social (ou nome do responsável). */
  entity: string;
  /** CNPJ formatado (00.000.000/0000-00). null = não configurado ou inválido. */
  cnpj: string | null;
};

export type LegalEnv = Partial<
  Record<
    'NEXT_PUBLIC_SUPPORT_EMAIL' | 'NEXT_PUBLIC_DPO_EMAIL' | 'NEXT_PUBLIC_LEGAL_ENTITY' | 'NEXT_PUBLIC_LEGAL_CNPJ',
    string | undefined
  >
>;

export const DEFAULT_ENTITY = 'Tostão';

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

/** Aceita só e-mail simples e bem formado (o valor vai parar num `mailto:` e em texto de página). */
export function cleanEmail(raw: string | undefined): string | null {
  const value = raw?.trim().toLowerCase();
  return value && value.length <= 254 && EMAIL_RE.test(value) ? value : null;
}

/** Valida os dois dígitos verificadores do CNPJ. Aceita com ou sem máscara. */
export function cleanCnpj(raw: string | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return null;
  const check = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((acc, d, i) => acc + Number(d) * weights[i]!, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = check(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = check(digits.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (digits.slice(12) !== `${d1}${d2}`) return null;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/** Tira caracteres de controle e limita o tamanho (o texto vai parar em página pública). */
function cleanEntity(raw: string | undefined): string {
  const value = (raw ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, 120);
  return value || DEFAULT_ENTITY;
}

export function resolveLegalConfig(env: LegalEnv): LegalConfig {
  const supportEmail = cleanEmail(env.NEXT_PUBLIC_SUPPORT_EMAIL);
  return {
    supportEmail,
    dpoEmail: cleanEmail(env.NEXT_PUBLIC_DPO_EMAIL) ?? supportEmail,
    entity: cleanEntity(env.NEXT_PUBLIC_LEGAL_ENTITY),
    cnpj: cleanCnpj(env.NEXT_PUBLIC_LEGAL_CNPJ),
  };
}

/** Leitura direta das variáveis (acesso literal: é assim que o Next troca NEXT_PUBLIC_* na hora do build). */
export function getLegalConfig(): LegalConfig {
  return resolveLegalConfig({
    NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    NEXT_PUBLIC_DPO_EMAIL: process.env.NEXT_PUBLIC_DPO_EMAIL,
    NEXT_PUBLIC_LEGAL_ENTITY: process.env.NEXT_PUBLIC_LEGAL_ENTITY,
    NEXT_PUBLIC_LEGAL_CNPJ: process.env.NEXT_PUBLIC_LEGAL_CNPJ,
  });
}

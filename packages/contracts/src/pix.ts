// Chave Pix: validação e forma canônica (como o DICT do Banco Central guarda). Puro, sem dependência além do Zod:
// a API valida e grava a forma canônica; a web usa os mesmos rótulos. A chave é dado pessoal: nunca vai pra log.
import { z } from 'zod';

export const PIX_KEY_TYPES = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Celular',
  aleatoria: 'Chave aleatória',
};

/** Tamanho máximo de uma chave no DICT (o do e-mail). É o que faz a chave sempre caber no campo 26 do BR Code. */
export const PIX_KEY_MAX = 77;

const PIX_KEY_ERRORS: Record<PixKeyType, string> = {
  cpf: 'Esse CPF não confere. Olha os números de novo.',
  cnpj: 'Esse CNPJ não confere. Olha os números de novo.',
  email: 'Esse e-mail não parece válido.',
  telefone: 'Usa o celular com DDD (ex.: 11 91234-5678).',
  aleatoria: 'A chave aleatória tem 32 letras e números separados por hífen. Copia direto do app do banco.',
};

const UUID_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Dígito verificador "módulo 11" (CPF e CNPJ). */
function checkDigit(digits: number[], weights: number[]) {
  const rest = weights.reduce((sum, weight, i) => sum + weight * digits[i]!, 0) % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const d = [...cpf].map(Number);
  const weights = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  return checkDigit(d, weights.slice(1)) === d[9] && checkDigit(d, weights) === d[10];
}

export function isValidCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const d = [...cnpj].map(Number);
  const weights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return checkDigit(d, weights.slice(1)) === d[12] && checkDigit(d, weights) === d[13];
}

/** Forma canônica da chave, ou null se não vale pro tipo escolhido. */
export function normalizePixKey(type: PixKeyType, raw: string): string | null {
  const value = raw.trim();
  const digits = value.replace(/\D/g, '');
  switch (type) {
    case 'cpf':
      return /^[\d.\-\s]+$/.test(value) && isValidCpf(digits) ? digits : null;
    case 'cnpj':
      return /^[\d.\-/\s]+$/.test(value) && isValidCnpj(digits) ? digits : null;
    case 'email': {
      const email = value.toLowerCase();
      return email.length <= PIX_KEY_MAX && z.email().safeParse(email).success && /^[\x21-\x7e]+$/.test(email)
        ? email
        : null;
    }
    case 'telefone': {
      if (!/^\+?[\d\s().-]+$/.test(value)) return null;
      // Com "+" a pessoa já informou o país: só vale Brasil. Sem "+", 11 dígitos são DDD + celular.
      const full = !value.startsWith('+') && digits.length === 11 ? `55${digits}` : digits;
      return /^55[1-9][1-9]9\d{8}$/.test(full) ? `+${full}` : null;
    }
    case 'aleatoria': {
      const key = value.toLowerCase();
      return UUID_KEY.test(key) ? key : null;
    }
  }
}

/** O tipo sai da própria forma canônica, então o banco só precisa guardar a chave. */
export function pixKeyTypeOf(key: string): PixKeyType | null {
  if (key.includes('@')) return 'email';
  if (key.startsWith('+')) return 'telefone';
  if (UUID_KEY.test(key)) return 'aleatoria';
  if (/^\d{11}$/.test(key)) return 'cpf';
  if (/^\d{14}$/.test(key)) return 'cnpj';
  return null;
}

/** PUT /me/pix-key. A pessoa escolhe o tipo (11 dígitos podem ser CPF ou celular: sem escolha, fica ambíguo). */
export const pixKeyBody = z
  .object({
    type: z.enum(PIX_KEY_TYPES, { error: 'Escolhe o tipo da chave' }),
    key: z
      .string({ error: 'Digite a sua chave Pix' })
      .trim()
      .min(1, 'Digite a sua chave Pix')
      .max(120, 'Chave longa demais'),
  })
  .transform(({ type, key }, ctx) => {
    const normalized = normalizePixKey(type, key);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', path: ['key'], message: PIX_KEY_ERRORS[type] });
      return z.NEVER;
    }
    return { type, key: normalized };
  });
export type PixKeyBody = z.input<typeof pixKeyBody>;

/** GET/PUT /me/pix-key. null = sem chave cadastrada. */
export type PixKeyResponse = { pixKey: string | null; type: PixKeyType | null };

// Um lugar só pra hash e conferência de senha. Troque o algoritmo/custo aqui e o resto do app acompanha.
import bcrypt from 'bcryptjs';
import { MAX_PASSWORD_BYTES } from '@tostao/contracts';

/** Custo do bcrypt (2^12 rodadas, ~250 ms). Hashes antigos (custo 10) seguem valendo e são refeitos no próximo login. */
export const BCRYPT_COST = 12;

/**
 * Hash válido (custo = BCRYPT_COST) de uma senha aleatória que ninguém conhece.
 * Serve pra gastar o MESMO tempo quando o e-mail não existe, senão o tempo de resposta entrega quem tem conta.
 */
export const DUMMY_PASSWORD_HASH = '$2b$12$YYpv3yvckRr./hEx2W8tPuAPqhRktv1yp7063jd3JobBqObM10eNe';

const tooLong = (plain: string) => Buffer.byteLength(plain, 'utf8') > MAX_PASSWORD_BYTES;

export async function hashPassword(plain: string): Promise<string> {
  // bcrypt só lê 72 bytes: acima disso senhas diferentes teriam o mesmo hash. A borda (Zod) já barra; aqui é a trava final.
  if (tooLong(plain)) throw new RangeError(`Senha acima de ${MAX_PASSWORD_BYTES} bytes`);
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (tooLong(plain)) return false;
  return bcrypt.compare(plain, hash);
}

/** Roda uma conferência inútil com o tempo de uma real (usuário inexistente ou conta sem senha). Sempre false. */
export async function burnPasswordCheck(plain: string): Promise<false> {
  await bcrypt.compare(tooLong(plain) ? '' : plain, DUMMY_PASSWORD_HASH);
  return false;
}

/** O hash foi feito com custo menor que o atual? Então vale refazer quando a pessoa entrar (a senha está em mãos). */
export function needsRehash(hash: string): boolean {
  const match = /^\$2[abxy]\$(\d{2})\$/.exec(hash);
  return !match || Number(match[1]) < BCRYPT_COST;
}

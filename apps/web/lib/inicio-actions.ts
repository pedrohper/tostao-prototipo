'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { PREFS_COOKIE, SECOES, parsePrefs, type InicioPrefs } from './inicio-prefs';

async function salvar(fn: (p: InicioPrefs) => InicioPrefs) {
  const jar = await cookies();
  const next = fn(parsePrefs(jar.get(PREFS_COOKIE)?.value));
  jar.set(PREFS_COOKIE, JSON.stringify(next), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  revalidatePath('/inicio');
}

/** Salva a ordem e o que fica escondido (tela Personalizar). */
export async function salvarInicio(ordem: string[], ocultos: string[]) {
  const ids = new Set<string>(SECOES.map((x) => x.id));
  await salvar((p) => ({ ...p, ordem: ordem.filter((id) => ids.has(id)), ocultos: ocultos.filter((id) => ids.has(id)) }));
  redirect('/inicio');
}

/** "Mostrar avisos dispensados". */
export async function mostrarFechados() {
  await salvar((p) => ({ ...p, fechados: [] }));
}

/** "Já resolvi": some com esse aviso. A chave muda quando o aviso é outro (outro mês, outra conta). */
export async function fecharAviso(key: string) {
  if (!key || key.length > 120) return;
  await salvar((p) => ({ ...p, fechados: [...p.fechados.filter((x) => x !== key), key].slice(-80) }));
}


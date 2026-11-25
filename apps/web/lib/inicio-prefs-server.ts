// Leitura das preferências da Home no servidor (T6.11): a conta manda; o cookie é só a cópia que segura a tela quando a
// API falha. Um erro aqui nunca derruba a Home.
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { HomePrefsResponse } from '@tostao/contracts';
import { api } from './api';
import { PREFS_COOKIE, resolveHomePrefs } from './inicio-prefs';
import { orFallback } from './rethrow';
import { TOKEN_COOKIE } from './session-constants';
import { accessTokenSub } from './token-expiry';

/** A Home espera isto antes de desenhar: passando desse tempo, segue com a cópia local. */
const PREFS_TIMEOUT_MS = 1500;

export const readHomePrefsState = cache(async () => {
  const [jar, remote] = await Promise.all([
    cookies(),
    api<HomePrefsResponse>('/me/home-prefs', { timeoutMs: PREFS_TIMEOUT_MS }).catch(orFallback(undefined)),
  ]);
  const token = jar.get(TOKEN_COOKIE)?.value;
  return resolveHomePrefs({
    remote,
    cookie: jar.get(PREFS_COOKIE)?.value,
    userId: token ? accessTokenSub(token) : null,
  });
});

export const readHomePrefs = async () => (await readHomePrefsState()).prefs;

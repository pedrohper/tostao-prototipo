'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { THEME_COOKIE, parseTheme, type ThemePreference } from './theme';

export async function setThemeAction(nextTheme: ThemePreference) {
  const theme = parseTheme(nextTheme);
  (await cookies()).set(THEME_COOKIE, theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}

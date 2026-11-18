export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_COOKIE = 'tostao-tema';

export function parseTheme(value: string | undefined | null): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}

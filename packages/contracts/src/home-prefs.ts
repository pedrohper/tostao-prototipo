// T6.11 · Preferências da Home guardadas na conta: quais blocos aparecem, em que ordem e quais avisos a pessoa fechou.
// A API grava e a web monta a tela com a MESMA regra de mistura (`applyHomePrefsPatch`): assim a Home já sai certa
// mesmo antes de a gravação voltar.
import { z } from 'zod';

/** Blocos da Home que dá pra esconder e reordenar, na ordem padrão. O que fica fixo no topo (saldo) não entra aqui. */
export const HOME_SECTION_IDS = [
  'atalhos',
  'pendencias',
  'evolucao',
  'sobra',
  'vence',
  'avisos',
  'pra-onde-foi',
  'aula',
  'semana',
  'meta',
  'acertos',
  'cartoes',
  'limites',
] as const;

export const MAX_DISMISSED_ALERTS = 80;
export const MAX_ALERT_KEY_LENGTH = 120;

type SectionId = (typeof HOME_SECTION_IDS)[number];
const isSectionId = (value: unknown): value is SectionId => (HOME_SECTION_IDS as readonly unknown[]).includes(value);
const isAlertKey = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_ALERT_KEY_LENGTH;

const sectionList = z
  .array(z.enum(HOME_SECTION_IDS))
  .max(HOME_SECTION_IDS.length)
  .refine((ids) => new Set(ids).size === ids.length, 'Bloco repetido');
const alertKeys = z.array(z.string().min(1).max(MAX_ALERT_KEY_LENGTH)).max(MAX_DISMISSED_ALERTS);

export const storedHomePrefsSchema = z.strictObject({
  ordem: sectionList,
  /** Ausente = a pessoa nunca escolheu o que esconder (vale o padrão da época). */
  ocultos: sectionList.optional(),
  /** Avisos fechados no X. Não contam como personalização. */
  fechados: alertKeys,
  /** Salvo pela tela Personalizar. */
  v: z.literal(2).optional(),
});
export type StoredHomePrefs = z.infer<typeof storedHomePrefsSchema>;

/** Corpo do `PATCH /me/home-prefs`: cada campo é uma mudança, aplicada nesta ordem. */
export const homePrefsPatchBody = z
  .strictObject({
    /** Cookie antigo deste aparelho: os blocos só entram se a conta ainda não tiver escolha; avisos fechados somam. */
    migrar: storedHomePrefsSchema.optional(),
    /** Escolha feita na tela Personalizar. */
    layout: z.strictObject({ ordem: sectionList, ocultos: sectionList }).optional(),
    restaurarAvisos: z.literal(true).optional(),
    fechar: alertKeys.min(1).optional(),
  })
  .refine((p) => p.migrar || p.layout || p.restaurarAvisos || p.fechar, 'Nada pra mudar');
export type HomePrefsPatch = z.infer<typeof homePrefsPatchBody>;

/** `prefs: null` = a conta ainda não guardou nada. */
export type HomePrefsResponse = { prefs: StoredHomePrefs | null };

/** A pessoa escolheu os próprios blocos? Fechar aviso não conta. */
export const hasHomeLayoutChoice = (prefs: StoredHomePrefs) =>
  prefs.v === 2 || prefs.ordem.length > 0 || prefs.ocultos !== undefined;

/** Junta avisos fechados sem repetir; passando do teto, saem os mais antigos (`older` antes de `newer`). */
const mergeDismissed = (older: readonly string[], newer: readonly string[]) =>
  [...older.filter((key) => !newer.includes(key)), ...new Set(newer)].slice(-MAX_DISMISSED_ALERTS);

export function applyHomePrefsPatch(current: StoredHomePrefs | null, patch: HomePrefsPatch): StoredHomePrefs {
  let next: StoredHomePrefs = current ?? { ordem: [], fechados: [] };
  const { migrar, layout, restaurarAvisos, fechar } = patch;
  if (migrar) {
    // A conta vence: um segundo aparelho nunca passa por cima de uma escolha que já chegou.
    const adopt = !hasHomeLayoutChoice(next) && hasHomeLayoutChoice(migrar);
    next = { ...(adopt ? migrar : next), fechados: mergeDismissed(migrar.fechados, next.fechados) };
  }
  if (layout) next = { ...next, ordem: layout.ordem, ocultos: layout.ocultos, v: 2 };
  if (restaurarAvisos) next = { ...next, fechados: [] };
  if (fechar) next = { ...next, fechados: mergeDismissed(next.fechados, fechar) };
  return next;
}

/**
 * Lê o que está gravado (ou num cookie) sem confiar no formato: um bloco que deixou de existir ou um valor estranho some
 * e o resto continua valendo. `null` quando não há nada pra ler.
 */
export function readStoredHomePrefs(raw: unknown): StoredHomePrefs | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const sections = (value: unknown) => [...new Set(Array.isArray(value) ? value.filter(isSectionId) : [])];
  const dismissed = Array.isArray(data.fechados) ? data.fechados.filter(isAlertKey) : [];
  return {
    ordem: sections(data.ordem),
    ...(Array.isArray(data.ocultos) ? { ocultos: sections(data.ocultos) } : {}),
    fechados: [...new Set(dismissed)].slice(-MAX_DISMISSED_ALERTS),
    ...(data.v === 2 ? { v: 2 as const } : {}),
  };
}

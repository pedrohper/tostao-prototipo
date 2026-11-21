'use client';
// Mostra UM simulador pelo id da lição. É Client Component porque o mapa SIMULATORS guarda funções (que não
// atravessam do servidor pro cliente): a página passa só dados simples (id, idioma e o contexto da pessoa).
import { SIMULATORS } from '@/app/(app)/aprender/[licao]/simulators';
import type { Locale } from '@/lib/i18n';
import type { LessonUserContext } from '@/lib/lesson-context';

export function SimulatorView({
  id,
  locale,
  userContext,
}: {
  id: string;
  locale: Locale;
  userContext: LessonUserContext | null;
}) {
  const Sim = SIMULATORS[id];
  return Sim ? <Sim locale={locale} userContext={userContext} /> : null;
}

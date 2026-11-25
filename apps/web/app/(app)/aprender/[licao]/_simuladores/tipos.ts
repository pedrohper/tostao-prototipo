import type { Locale } from '@/lib/i18n';
import type { LessonUserContext } from '@/lib/lesson-context';

/** `userContext` = os números reais da pessoa (ou null: a lição fica com os valores didáticos de sempre). */
export type SimulatorProps = { locale: Locale; userContext?: LessonUserContext | null };

/** Um simulador por id de lição ("m3-l2"). */
export type MapaDeSimuladores = Record<string, (props: SimulatorProps) => React.ReactNode>;

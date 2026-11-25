'use client';
// Simuladores das lições: um por id, todos no SimuladorShell (T6.13 e T6.15). Cada módulo tem o próprio mapa em
// `_simuladores/modulo-N.tsx`; um simulador novo entra no mapa do módulo dele.
import { BalancoDoEstagio } from './_simuladores/balanco-do-estagio';
import { BolaDeNeveDoMinimo } from './_simuladores/bola-de-neve-do-minimo';
import { CalculadoraHoraDeFreela } from './_simuladores/hora-de-freela';
import { MODULO_1 } from './_simuladores/modulo-1';
import { MODULO_2 } from './_simuladores/modulo-2';
import { MODULO_3 } from './_simuladores/modulo-3';
import { MODULO_4 } from './_simuladores/modulo-4';
import { MODULO_5 } from './_simuladores/modulo-5';
import { MODULO_6 } from './_simuladores/modulo-6';
import { MODULO_7 } from './_simuladores/modulo-7';
import { MODULO_8 } from './_simuladores/modulo-8';
import { MODULO_9 } from './_simuladores/modulo-9';
import type { MapaDeSimuladores } from './_simuladores/tipos';

export type { SimulatorProps } from './_simuladores/tipos';

export const SIMULATORS: MapaDeSimuladores = {
  ...MODULO_1,
  ...MODULO_2,
  'm2-l2': BolaDeNeveDoMinimo,
  ...MODULO_3,
  ...MODULO_4,
  ...MODULO_5,
  'm5-l3': BalancoDoEstagio,
  'm5-l4': CalculadoraHoraDeFreela,
  ...MODULO_6,
  ...MODULO_7,
  ...MODULO_8,
  ...MODULO_9,
};

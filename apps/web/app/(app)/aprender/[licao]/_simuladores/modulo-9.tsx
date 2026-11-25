'use client';
// Módulo 9 (Golpes, apostas e armadilhas): os simuladores, um arquivo cada.
import { ContaAbsurdoEconomico } from './conta-absurdo-economico';
import { EscrutinioDaVaga } from './escrutinio-da-vaga';
import { QuebraGeometricaPiramide } from './quebra-geometrica-piramide';
import { TesteFalsaCentral } from './teste-falsa-central';
import type { MapaDeSimuladores } from './tipos';
import { VantagemDaBanca } from './vantagem-da-banca';

export const MODULO_9: MapaDeSimuladores = {
  'm9-l1': TesteFalsaCentral,
  'm9-l2': VantagemDaBanca,
  'm9-l3': QuebraGeometricaPiramide,
  'm9-l4': EscrutinioDaVaga,
  'm9-l5': ContaAbsurdoEconomico,
};

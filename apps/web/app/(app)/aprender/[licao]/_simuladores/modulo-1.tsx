'use client';
// Módulo 1 no SimuladorShell (T6.15).
import { AjusteDasFatias } from './ajuste-das-fatias';
import { BisturiNoFixo } from './bisturi-no-fixo';
import { DetectorGatilhos } from './detector-gatilhos';
import { RaloDoCafezinho } from './ralo-do-cafezinho';
import { RemanejamentoEmergencia } from './remanejamento-emergencia';
import type { MapaDeSimuladores } from './tipos';

export const MODULO_1: MapaDeSimuladores = {
  'm1-l1': RaloDoCafezinho,
  'm1-l2': AjusteDasFatias,
  'm1-l3': BisturiNoFixo,
  'm1-l4': RemanejamentoEmergencia,
  'm1-l5': DetectorGatilhos,
};

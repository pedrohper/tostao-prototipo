'use client';
// Módulo 5 no SimuladorShell (T6.15). A m5-l3 e a m5-l4 (pilotos) entram pelos arquivos delas.
import { AlocacaoRendaExtra } from './alocacao-renda-extra';
import { AportesVsAumentoDeRenda } from './aportes-vs-aumento-de-renda';
import { CalculadoraRoiEducacional } from './calculadora-roi-educacional';
import type { MapaDeSimuladores } from './tipos';

export const MODULO_5: MapaDeSimuladores = {
  'm5-l1': AportesVsAumentoDeRenda,
  'm5-l2': CalculadoraRoiEducacional,
  'm5-l5': AlocacaoRendaExtra,
};

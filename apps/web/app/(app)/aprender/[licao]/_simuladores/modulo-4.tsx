'use client';
// Módulo 4 (Reserva de emergência): os simuladores, um arquivo cada.
import { CalculadoraCustoBasico } from './calculadora-custo-basico';
import { ComparadorLiquidezSeguranca } from './comparador-liquidez-seguranca';
import { ReconstrucaoDoMuro } from './reconstrucao-do-muro';
import { SemaforoDaEmergencia } from './semaforo-da-emergencia';
import { TermometroPazDeEspirito } from './termometro-paz-de-espirito';
import type { MapaDeSimuladores } from './tipos';

export const MODULO_4: MapaDeSimuladores = {
  'm4-l1': CalculadoraCustoBasico,
  'm4-l2': ComparadorLiquidezSeguranca,
  'm4-l3': SemaforoDaEmergencia,
  'm4-l4': ReconstrucaoDoMuro,
  'm4-l5': TermometroPazDeEspirito,
};

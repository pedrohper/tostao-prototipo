'use client';
// Módulo 8 (bolsa sem hype) no SimuladorShell (T6.15).
import { ApostaIndividualVsIndice } from './aposta-vs-indice';
import { DetectorCharlatanismo } from './detector-de-charlatanismo';
import { RendaPassivaFIIs } from './renda-passiva-fiis';
import { SocioVsApostador } from './socio-vs-apostador';
import { TesteCardiacoVolatilidade } from './teste-da-volatilidade';
import type { MapaDeSimuladores } from './tipos';

export const MODULO_8: MapaDeSimuladores = {
  'm8-l1': SocioVsApostador,
  'm8-l2': RendaPassivaFIIs,
  'm8-l3': ApostaIndividualVsIndice,
  'm8-l4': DetectorCharlatanismo,
  'm8-l5': TesteCardiacoVolatilidade,
};

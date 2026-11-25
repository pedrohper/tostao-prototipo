'use client';
// Módulo 3 (Saindo das dívidas): os simuladores, um arquivo cada.
import { AvalancheVsBolaDeNeve } from './avalanche-vs-bola-de-neve';
import { CalculadoraMinimoExistencial } from './calculadora-minimo-existencial';
import { CalculadoraValorOriginal } from './calculadora-valor-original';
import { SimuladorDesenrolaSerasa } from './simulador-desenrola-serasa';
import { TermometroDeSangria } from './termometro-de-sangria';
import type { MapaDeSimuladores } from './tipos';

export const MODULO_3: MapaDeSimuladores = {
  'm3-l1': TermometroDeSangria,
  'm3-l2': AvalancheVsBolaDeNeve,
  'm3-l3': CalculadoraValorOriginal,
  'm3-l4': SimuladorDesenrolaSerasa,
  'm3-l5': CalculadoraMinimoExistencial,
};

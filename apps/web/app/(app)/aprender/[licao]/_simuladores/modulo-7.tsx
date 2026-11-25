'use client';
// Módulo 7 (renda fixa e Tesouro) no SimuladorShell (T6.15).
import { CalculadoraCDI } from './calculadora-do-cdi';
import { CalculadoraGanhoReal } from './ganho-real';
import { RaioXGarantiaFGC } from './garantia-fgc';
import { MapaDoTesouro } from './mapa-do-tesouro';
import { MordidaLeaoResgate } from './mordida-do-leao';
import type { MapaDeSimuladores } from './tipos';

export const MODULO_7: MapaDeSimuladores = {
  'm7-l1': CalculadoraCDI,
  'm7-l2': RaioXGarantiaFGC,
  'm7-l3': MordidaLeaoResgate,
  'm7-l4': MapaDoTesouro,
  'm7-l5': CalculadoraGanhoReal,
};

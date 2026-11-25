'use client';
// Módulo 2 no SimuladorShell (T6.15). A m2-l2 (piloto) entra pelo arquivo dela.
import { CompensaParcelar } from './compensa-parcelar';
import { IlusaoDePoder } from './ilusao-de-poder';
import { RaioXDoCetNoPix } from './raio-x-do-cet-no-pix';
import { ReguaDeDatas } from './regua-de-datas';
import type { MapaDeSimuladores } from './tipos';

export const MODULO_2: MapaDeSimuladores = {
  'm2-l1': IlusaoDePoder,
  'm2-l3': CompensaParcelar,
  'm2-l4': RaioXDoCetNoPix,
  'm2-l5': ReguaDeDatas,
};

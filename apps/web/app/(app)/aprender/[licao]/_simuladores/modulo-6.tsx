'use client';
// Módulo 6 (primeiro salário) no SimuladorShell (T6.15).
import { EquivalenciaCltPj } from './clt-vs-pj';
import { FatiadorDecimoTerceiro } from './fatiador-do-13';
import { CalculadoraHoleriteReal } from './holerite-real';
import { ContaRetornoFerias } from './retorno-das-ferias';
import { SaqueAniversarioVsRescisao } from './saque-aniversario';
import type { MapaDeSimuladores } from './tipos';

export const MODULO_6: MapaDeSimuladores = {
  'm6-l1': CalculadoraHoleriteReal,
  'm6-l2': SaqueAniversarioVsRescisao,
  'm6-l3': FatiadorDecimoTerceiro,
  'm6-l4': ContaRetornoFerias,
  'm6-l5': EquivalenciaCltPj,
};

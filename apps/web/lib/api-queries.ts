// Leituras da API que várias partes da MESMA página repetem (layout + página + seções). `cache()` do React guarda o
// resultado durante UM render: a segunda chamada reaproveita a primeira em vez de ir de novo à API.
// Antes o /inicio fazia ~15 chamadas HTTP, com /progress, /missions e /tostao/auto buscados duas vezes.
import { cache } from 'react';
import type {
  InstitutionLogosResponse,
  LessonProgressResponse,
  MissionsResponse,
  ProfileResponse,
  TostaoAutoResponse,
} from '@tostao/contracts';
import { api } from './api';

export const getMe = cache(() => api<ProfileResponse>('/me'));
export const getProgress = cache(() => api<LessonProgressResponse>('/progress'));
export const getMissions = cache(() => api<MissionsResponse>('/missions'));
export const getTostaoAuto = cache(() => api<TostaoAutoResponse>('/tostao/auto'));

export type BankLogo = InstitutionLogosResponse['logos'][number];

/** Logos oficiais (lista de bancos do Pluggy). Muda raramente: cache de 1 hora; se falhar ou vier vazio, usa as marcas locais. */
export const getBankLogos = cache(async (): Promise<BankLogo[]> => {
  try {
    return (await api<InstitutionLogosResponse>('/institutions/logos', { revalidate: 3600 })).logos;
  } catch {
    return [];
  }
});

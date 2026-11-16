'use server';
import { revalidatePath } from 'next/cache';
import type {
  ApplyTostaoInsightResponse,
  RunTostaoCheckResponse,
  TostaoAutoConfigDTO,
  TostaoInsightDTO,
  UpdateTostaoAutoConfigBody,
} from '@tostao/contracts';
import { api } from './api';

export async function runTostaoCheckAction(): Promise<RunTostaoCheckResponse> {
  const res = await api<RunTostaoCheckResponse>('/tostao/auto/check', { method: 'POST' });
  revalidatePath('/inicio');
  revalidatePath('/tostao');
  revalidatePath('/carteira');
  return res;
}

export async function applyTostaoInsightAction(id: string): Promise<ApplyTostaoInsightResponse> {
  const res = await api<ApplyTostaoInsightResponse>(`/tostao/insights/${id}/apply`, { method: 'POST' });
  revalidatePath('/inicio');
  revalidatePath('/tostao');
  revalidatePath('/carteira');
  revalidatePath('/assinaturas');
  return res;
}

export async function dismissTostaoInsightAction(id: string): Promise<TostaoInsightDTO> {
  const res = await api<TostaoInsightDTO>(`/tostao/insights/${id}/dismiss`, { method: 'POST' });
  revalidatePath('/inicio');
  revalidatePath('/tostao');
  return res;
}

export async function updateTostaoAutoConfigAction(patch: UpdateTostaoAutoConfigBody): Promise<TostaoAutoConfigDTO> {
  const res = await api<TostaoAutoConfigDTO>('/tostao/auto/config', { method: 'PUT', body: patch });
  revalidatePath('/mais');
  revalidatePath('/tostao');
  revalidatePath('/inicio');
  return res;
}

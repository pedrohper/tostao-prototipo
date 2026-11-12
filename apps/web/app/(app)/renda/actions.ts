'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { financialPlanBody } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';

export type PlanState = { error?: string };

export async function savePlan(_: PlanState, form: FormData): Promise<PlanState> {
  let raw: unknown;
  try { raw = JSON.parse(String(form.get('plan') ?? '{}')); } catch { return { error: 'Algo deu errado.' }; }
  const parsed = financialPlanBody.safeParse(raw);
  if (!parsed.success) return { error: 'Confere os valores: algum campo ficou vazio ou estranho.' };
  try {
    await api('/plan', { method: 'PUT', body: parsed.data });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  redirect('/previsao');
}

'use server';
import { revalidatePath } from 'next/cache';
import { urubuStepBody } from '@tostao/contracts';
import { api } from '@/lib/api';

export async function startTigrinho() {
  await api('/battles/tigrinho/start', { method: 'POST', body: {} });
  revalidatePath('/batalha');
  revalidatePath('/aprender');
}

export async function toggleUrubuStep(form: FormData) {
  const id = String(form.get('stepId') ?? '');
  const body = urubuStepBody.safeParse({ done: form.get('done') === 'true' });
  if (!id || !body.success) return;
  await api(`/battles/urubu/steps/${encodeURIComponent(id)}`, { method: 'PUT', body: body.data }).catch(() => null);
  revalidatePath('/batalha');
  revalidatePath('/aprender');
}

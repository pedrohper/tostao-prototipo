'use server';
import { revalidatePath } from 'next/cache';
import { ignoreSubscriptionBody } from '@tostao/contracts';
import { api } from '@/lib/api';

export async function setIgnored(form: FormData) {
  const parsed = ignoreSubscriptionBody.safeParse({ key: form.get('key'), ignored: form.get('ignored') === 'true' });
  if (!parsed.success) return;
  try {
    await api('/subscriptions/ignored', { method: 'PUT', body: parsed.data });
  } catch { /* se falhar, a lista só não muda */ }
  revalidatePath('/', 'layout');
}

'use server';
import { revalidateFinance } from '@/lib/revalidate';
import { ignoreSubscriptionBody } from '@tostao/contracts';
import { api } from '@/lib/api';
import { rethrowIfRedirect } from '@/lib/rethrow';

export async function setIgnored(form: FormData) {
  const parsed = ignoreSubscriptionBody.safeParse({ key: form.get('key'), ignored: form.get('ignored') === 'true' });
  if (!parsed.success) return;
  try {
    await api('/subscriptions/ignored', { method: 'PUT', body: parsed.data });
  } catch (caught) {
    rethrowIfRedirect(caught);
    /* se falhar, a lista só não muda */
  }
  revalidateFinance();
}

import { redirect } from 'next/navigation';
import { getToken } from '@/lib/session';

export default async function Root() {
  redirect((await getToken()) ? '/inicio' : '/entrar');
}

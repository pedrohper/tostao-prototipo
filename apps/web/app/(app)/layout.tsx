import { redirect } from 'next/navigation';
import { getToken } from '@/lib/session';
import { Nav } from '@/components/nav';

// Tudo dentro de (app) exige login. Sem cookie, volta pro /entrar.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await getToken())) redirect('/entrar');
  return (
    <div className="md:flex md:min-h-dvh">
      <Nav />
      <main className="mx-auto w-full max-w-[640px] px-5 pt-12 pb-28 md:px-8 md:pb-12">{children}</main>
    </div>
  );
}

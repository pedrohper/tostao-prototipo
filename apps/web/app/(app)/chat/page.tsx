import { redirect } from 'next/navigation';

export default async function ChatPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const q = sp.q?.trim();
  redirect(q ? `/tostao?q=${encodeURIComponent(q)}` : '/tostao');
}

import type { ChatHistoryResponse, ProfileResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { ChatClient } from './chat-client';

export default async function ChatPage() {
  const [{ messages }, me] = await Promise.all([api<ChatHistoryResponse>('/chat'), api<ProfileResponse>('/me')]);
  return <ChatClient initial={messages} firstName={me.name.split(' ')[0] ?? me.name} />;
}

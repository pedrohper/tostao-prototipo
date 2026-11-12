import type { ChatHistoryResponse, FinancialPlanResponse, ProfileResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { ChatClient } from './chat-client';

export default async function ChatPage() {
  const [{ messages }, me, { plan }] = await Promise.all([api<ChatHistoryResponse>('/chat'), api<ProfileResponse>('/me'), api<FinancialPlanResponse>('/plan').catch(() => ({ plan: null }))]);
  const last = me.connections.map((c) => c.lastSyncedAt).filter((x): x is string => !!x).sort().at(-1);
  const synced = last
    ? `${plan ? 'Sabe seu salário, contas fixas e gastos' : 'Conhece seus gastos'} até ${new Date(last).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) === new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) ? 'hoje' : new Date(last).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'short' })}, ${new Date(last).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}`
    : 'Pergunta qualquer coisa sobre o seu dinheiro.';
  return <ChatClient initial={messages} firstName={me.name.split(' ')[0] ?? me.name} subtitle={synced} askIncome={!plan} />;
}

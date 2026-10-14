import type { Conflict, DialogueResponse, Memory, Session } from '../types';
const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.detail || `Request failed (${res.status})`); }
  return res.json();
}
export const api = {
  health: () => request<{status:string}>('/health'),
  stalls: () => request<{stalls:Array<{id:string;food:string;vendor:string;description:string;color:string;personality:string}>}>('/api/v1/sessions/stalls'),
  createSession: () => request<Session>('/api/v1/sessions', { method:'POST', body:JSON.stringify({player_name:'Visitor',scenario_id:'evening_food_plaza'}) }),
  session: (id:string) => request<Session>(`/api/v1/sessions/${id}`),
  dialogue: (id:string, message:string, npc_id:string) => request<DialogueResponse>(`/api/v1/sessions/${id}/dialogue`, { method:'POST', body:JSON.stringify({message,location:'evening_food_plaza',npc_id}) }),
  memories: (id:string) => request<{memories:Memory[]; conflicts:Conflict[]}>(`/api/v1/sessions/${id}/memories?limit=50`),
  messages: (id:string,npcId='') => request<{messages:Array<{role:'player'|'aria'|'npc';speaker:string|null;content:string}>}>(`/api/v1/sessions/${id}/messages${npcId?`?npc_id=${encodeURIComponent(npcId)}`:''}`),
};

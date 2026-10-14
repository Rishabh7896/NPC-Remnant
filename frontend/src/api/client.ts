import type { Conflict, DialogueResponse, Memory, Session } from '../types';
const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.detail || `Request failed (${res.status})`); }
  return res.json();
}
export const api = {
  health: () => request<{status:string}>('/health'),
  createSession: () => request<Session>('/api/v1/sessions', { method:'POST', body:JSON.stringify({player_name:'Commander',scenario_id:'mars_station_01'}) }),
  session: (id:string) => request<Session>(`/api/v1/sessions/${id}`),
  dialogue: (id:string, message:string, location='control_room') => request<DialogueResponse>(`/api/v1/sessions/${id}/dialogue`, { method:'POST', body:JSON.stringify({message,location}) }),
  memories: (id:string) => request<{memories:Memory[]; conflicts:Conflict[]}>(`/api/v1/sessions/${id}/memories?limit=50`),
  messages: (id:string) => request<{messages:Array<{role:'player'|'aria'|'system';content:string}>}>(`/api/v1/sessions/${id}/messages`),
  evidence: (id:string,evidence_id:string) => request<any>(`/api/v1/sessions/${id}/evidence`, {method:'POST',body:JSON.stringify({evidence_id})}),
  action: (id:string,action_type:string) => request<any>(`/api/v1/sessions/${id}/actions`, {method:'POST',body:JSON.stringify({action_type})}),
};

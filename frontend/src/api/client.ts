import type { Conflict, DialogueResponse, Memory, Session, Cart, Product, Receipt, Wallet } from '../types';
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
  interact: (id:string, message:string, npc_id:string) => request<DialogueResponse>(`/api/v1/sessions/${id}/interact`, { method:'POST', body:JSON.stringify({message,location:'evening_food_plaza',npc_id}) }),
  memories: (id:string) => request<{memories:Memory[]; conflicts:Conflict[]}>(`/api/v1/sessions/${id}/memories?limit=50`),
  messages: (id:string,npcId='') => request<{messages:Array<{role:'player'|'aria'|'npc';speaker:string|null;content:string}>}>(`/api/v1/sessions/${id}/messages${npcId?`?npc_id=${encodeURIComponent(npcId)}`:''}`),
  catalog: (id:string, vendorId:string) => request<{vendor_id:string; catalog:Product[]; negotiation_policy:{max_discount_pct:number;min_cart_total:number;policy_note:string}}>(`/api/v1/sessions/${id}/shop/catalog/${encodeURIComponent(vendorId)}`),
  cart: (id:string, vendorId='') => request<Cart>(`/api/v1/sessions/${id}/cart${vendorId?`?vendor_id=${encodeURIComponent(vendorId)}`:''}`),
  addToCart: (id:string, item:{vendor_id:string;product_id:string;quantity?:number;variant_id?:string;add_on_ids?:string[];notes?:string}) => request<{status:string;message:string;cart:Cart}>(`/api/v1/sessions/${id}/cart/items`, { method:'POST', body:JSON.stringify(item) }),
  removeFromCart: (id:string, itemId:string, vendorId='') => request<{status:string;message:string;cart:Cart}>(`/api/v1/sessions/${id}/cart/items/${encodeURIComponent(itemId)}${vendorId?`?vendor_id=${encodeURIComponent(vendorId)}`:''}`, { method:'DELETE' }),
  clearCart: (id:string) => request<{status:string;cart_id:string}>(`/api/v1/sessions/${id}/cart/clear`, { method:'POST' }),
  applyDiscount: (id:string, vendorId:string, proposed_discount:number, reason='friendly_bargaining') => request<{applied:boolean;approved_discount:number;message:string;cart:Cart}>(`/api/v1/sessions/${id}/cart/discount`, { method:'POST', body:JSON.stringify({vendor_id:vendorId, proposed_discount, reason}) }),
  checkout: (id:string, idempotency_key='') => request<{status:string;receipt:Receipt;message:string}>(`/api/v1/sessions/${id}/cart/checkout`, { method:'POST', body:JSON.stringify({idempotency_key}) }),
  orders: (id:string, vendorId='') => request<{orders:Receipt[]}>(`/api/v1/sessions/${id}/orders${vendorId?`?vendor_id=${encodeURIComponent(vendorId)}`:''}`),
  wallet: (id:string) => request<Wallet>(`/api/v1/sessions/${id}/wallet`),
};

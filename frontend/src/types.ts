export type Memory = { id: string; claim_key: string; claim_text: string; subject: string; predicate: string; value: string; source_type: string; source_id: string | null; confidence: number; status: string; created_at: string };
export type Conflict = { id: string; memory_a_id: string; memory_b_id: string; status: string; resolution_note: string | null; created_at: string };
export type GameState = { game?: string; place: string; visited: string[]; status: string; last_event: string };
export type Session = { session_id: string; npc_id: string; mission: { id: string; status: string; step: string }; game_state: GameState };

export type CartItem = {
  line_id: string;
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  variant?: { id: string; name: string; price_delta: number } | null;
  add_ons?: Array<{ id: string; name: string; price: number }>;
  notes?: string;
  line_total: number;
};

export type Cart = {
  cart_id: string;
  vendor_id: string;
  items: CartItem[];
  subtotal: number;
  discount_amount: number;
  discount_reason?: string;
  total: number;
  state: string;
};

export type Receipt = {
  order_id: string;
  vendor_id: string;
  vendor_name: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  balance_remaining?: number;
  created_at: string;
  idempotent_replay?: boolean;
};

export type Product = {
  product_id: string;
  vendor_id: string;
  name: string;
  description: string;
  category: string;
  base_price: number;
  currency: string;
  available: boolean;
  stock_quantity: number;
  variants: Array<{ id: string; name: string; price_delta: number }>;
  add_ons: Array<{ id: string; name: string; price: number }>;
  ingredients: string[];
  allergens: string[];
  preparation_time: string;
  min_price?: number;
  max_discount_pct?: number;
};

export type Wallet = {
  currency: string;
  balance: number;
  symbol: string;
};

export type DialogueResponse = {
  reply: string;
  npc: { id: string; name: string };
  memory_updates: Memory[];
  memories: Memory[];
  game_state: GameState;
  provider: 'llm' | 'offline';
  intent?: 'navigate' | 'talk' | 'plaza_chat';
  action?: { type: 'navigate' | 'talk' | 'none'; stall_id?: string };
  cart?: Cart | null;
  wallet?: Wallet | null;
  receipt?: Receipt | null;
  events?: Array<{ type: string; [key: string]: any }>;
};

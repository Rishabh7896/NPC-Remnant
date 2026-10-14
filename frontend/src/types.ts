export type Memory = { id: string; claim_key: string; claim_text: string; subject: string; predicate: string; value: string; source_type: string; source_id: string | null; confidence: number; status: string; created_at: string };
export type Conflict = { id: string; memory_a_id: string; memory_b_id: string; status: string; resolution_note: string | null; created_at: string };
export type GameState = { game?: string; place: string; visited: string[]; status: string; last_event: string };
export type Session = { session_id: string; npc_id: string; mission: { id: string; status: string; step: string }; game_state: GameState };
export type DialogueResponse = { reply: string; npc:{id:string;name:string}; memory_updates:Memory[]; memories:Memory[]; game_state:GameState; provider:'llm'|'offline'; intent?:'navigate'|'talk'|'plaza_chat'; action?:{type:'navigate'|'talk'|'none';stall_id?:string} };

export type Memory = { id: string; claim_key: string; claim_text: string; subject: string; predicate: string; value: string; source_type: string; source_id: string | null; confidence: number; status: string; created_at: string };
export type Conflict = { id: string; memory_a_id: string; memory_b_id: string; status: string; resolution_note: string | null; created_at: string };
export type GameState = { engineering_wing: string; reactor: string; sensor: string; sensor_repaired: boolean };
export type Session = { session_id: string; npc_id: string; mission: { id: string; status: string; step: string }; game_state: GameState };
export type DialogueResponse = { reply: string; memory_updates: Memory[]; beliefs: Array<{subject:string; predicate:string; value:string; confidence:number; status:string}>; action_proposal: {type:string; reason:string} | null; action_result: {accepted:boolean; reason:string} | null };

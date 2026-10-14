import { Store, Utensils, Check } from 'lucide-react';
import type { GameState } from '../types';
import type { Stall } from '../scene/GameScene';

export default function StallDirectory({stalls,gameState,selectedId,onSelect}:{stalls:Stall[];gameState:GameState;selectedId:string;onSelect:(id:string)=>void}) {
  const visited=new Set(gameState.visited||[]);
  return <section className="panel mission-panel plaza-guide">
    <div className="panel-heading"><div><span className="eyebrow">THE NEIGHBORHOOD</span><h2><Store size={18}/> Explore the food plaza</h2></div><span className="count-pill">{visited.size} / {stalls.length} VISITED</span></div>
    <p className="plaza-intro">18 family-run stalls, each with a story. Pick a name or click a stall in the 3D plaza to walk over and talk.</p>
    <div className="stall-directory">{stalls.map(stall=><button key={stall.id} className={`stall-chip ${selectedId===stall.id?'selected':''}`} onClick={()=>onSelect(stall.id)}>
      <span className="stall-dot" style={{background:stall.color}}/><span className="stall-chip-text"><b>{stall.food}</b><small>{stall.vendor}</small></span>{visited.has(stall.id)?<Check size={14}/>:<Utensils size={13}/>}
    </button>)}</div>
  </section>;
}

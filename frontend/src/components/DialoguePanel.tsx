import { useState } from 'react';
import { Send, Bot, UserRound, LoaderCircle } from 'lucide-react';
export type ChatItem = {role:'player'|'aria';content:string};
export default function DialoguePanel({messages,onSend,busy}:{messages:ChatItem[];onSend:(message:string)=>void;busy:boolean}) {
 const [value,setValue]=useState('');
 const submit=(e:React.FormEvent)=>{e.preventDefault();const v=value.trim();if(v&&!busy){onSend(v);setValue('')}};
 return <section className="panel dialogue-panel"><div className="panel-heading"><div><span className="eyebrow">COMMS CHANNEL 01</span><h2>Talk to ARIA</h2></div><span className="live-chip"><i/> LIVE</span></div>
 <div className="chat-log">{messages.map((m,i)=><div className={`chat-row ${m.role}`} key={i}><div className="chat-avatar">{m.role==='aria'?<Bot size={16}/>:<UserRound size={16}/>}</div><div><div className="chat-name">{m.role==='aria'?'ARIA':'YOU'}</div><p>{m.content}</p></div></div>)}{busy&&<div className="thinking"><LoaderCircle size={15} className="spin"/> ARIA is processing context…</div>}</div>
 <div className="suggestions"><button onClick={()=>onSend('What do you currently believe about the engineering wing, and why?')} disabled={busy}>What do you believe?</button><button onClick={()=>onSend('What evidence would change your recommendation?')} disabled={busy}>What evidence do you need?</button></div>
 <form className="chat-form" onSubmit={submit}><input value={value} onChange={e=>setValue(e.target.value)} placeholder="Message your crew companion…" aria-label="Message ARIA"/><button aria-label="Send message" disabled={busy||!value.trim()}><Send size={17}/></button></form></section>
}

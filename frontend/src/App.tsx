import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertOctagon, Compass, Play, Sparkles, Store, Users, MessageCircle, Wifi, WifiOff } from 'lucide-react';
import type { Stall } from './scene/GameScene';
import DialoguePanel, { type ChatItem } from './components/DialoguePanel';
import CognitiveInspector from './components/CognitiveInspector';
import { api } from './api/client';
import type { Conflict, Memory, Session } from './types';

const GameScene=lazy(()=>import('./scene/GameScene'));

export default function App(){
 const [session,setSession]=useState<Session|null>(null);
 const [stalls,setStalls]=useState<Stall[]>([]);
 const [activeId,setActiveId]=useState('');
 const [messages,setMessages]=useState<ChatItem[]>([]);
 const [allMessages,setAllMessages]=useState<ChatItem[]>([]);
 const [memories,setMemories]=useState<Memory[]>([]);
 const [conflicts,setConflicts]=useState<Conflict[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [online,setOnline]=useState(false);
 const [provider,setProvider]=useState('');
 const [arrivalId,setArrivalId]=useState('');
 const [gameStarted,setGameStarted]=useState(false);
 const activeStall=useMemo(()=>stalls.find(stall=>stall.id===activeId)||null,[stalls,activeId]);
 const toChat=(items:Array<{role:string;speaker:string|null;content:string}>,speakLast=false):ChatItem[]=>items.map((x,index)=>({role:x.role as ChatItem['role'],speaker:x.speaker,content:x.content,shouldSpeak:speakLast&&index===items.length-1&&x.role!=='player'}));

 const refresh=useCallback(async(id:string,npcId='')=>{
  try{
   const [s,m,ch]=await Promise.all([api.session(id),api.memories(id),api.messages(id,npcId)]);
   setSession(s);setMemories(m.memories);setConflicts(m.conflicts);
   const transcript=toChat(ch.messages);
   if(npcId)setMessages(transcript);
   else setAllMessages(transcript);
  }catch(e){setError(e instanceof Error?e.message:'Could not refresh plaza state')}
 },[]);
 const ensureSession=useCallback(async()=>{
  if(session)return session;
  const id=localStorage.getItem('remnant-session');
  if(id){try{const existing=await api.session(id);setSession(existing);localStorage.setItem('remnant-session',id);setOnline(true);await refresh(id);return existing}catch{localStorage.removeItem('remnant-session')}}
  const created=await api.createSession();setSession(created);setMessages([]);setAllMessages([]);setMemories([]);setConflicts([]);
  localStorage.setItem('remnant-session',created.session_id);setOnline(true);setProvider('');return created;
 },[refresh,session]);
 useEffect(()=>{api.stalls().then(result=>setStalls(result.stalls)).catch(e=>setError(e instanceof Error?e.message:'Could not load the plaza'))},[]);
 useEffect(()=>{
  const id=localStorage.getItem('remnant-session');
  if(id)refresh(id).then(()=>setOnline(true)).catch(()=>setOnline(false));
 },[refresh]);
 const start=async()=>{
  setBusy(true);setError('');
  try{await ensureSession();setActiveId('');setMessages([]);setGameStarted(true)}
  catch(e){setOnline(false);setError(e instanceof Error?e.message:'Could not connect to the plaza')}
  finally{setBusy(false)}
 };
 const selectStall=(id:string)=>{
  setActiveId(id);setArrivalId('');
  if(session)api.messages(session.session_id,id).then(result=>setMessages(toChat(result.messages))).catch(()=>setMessages([]));
 };
 const send=async(message:string)=>{
  if(!session)return;
  setBusy(true);setError('');setMessages(old=>[...old,{role:'player',content:message}]);
  try{
   const result=await api.interact(session.session_id,message,activeId);
   setProvider(result.provider);
   if(result.action?.type==='navigate'&&result.action.stall_id){
    const target=result.action.stall_id;setActiveId(target);setArrivalId('');
    const thread=await api.messages(session.session_id,target);setMessages(toChat(thread.messages,true));
   }else{
    const target=result.action?.stall_id||activeId;
    if(target&&target!==activeId){setActiveId(target);setArrivalId('')}
    const thread=await api.messages(session.session_id,target);
    setMessages(toChat(thread.messages,true));
   }
   await refresh(session.session_id);
  }catch(e){setError(e instanceof Error?e.message:'Conversation failed');setMessages(old=>[...old,{role:'aria',speaker:'Plaza guide',content:'I lost the plaza signal for a moment. Try that again?'}])}
  finally{setBusy(false)}
 };
 const arrive=(id:string)=>setArrivalId(id);
 const gameState=session?.game_state||{game:'after_hours_city',place:'Old Town Square',visited:[],status:'roaming',last_event:'The evening lights are coming on.'};
 const finish=()=>{setGameStarted(false);setActiveId('');if(session)refresh(session.session_id)};

 if(!gameStarted)return <main className="landing-screen">
  <header className="landing-topbar"><div className="brand"><div className="brand-mark"><Compass size={20}/></div><div><strong>PROJECT <span>REMNANT</span></strong><small>AFTER HOURS · FOOD PLAZA</small></div></div><div className={`landing-link ${online?'online':''}`}>{online?<Wifi size={14}/>:<WifiOff size={14}/>} {online?'YOUR EVENING IS SAVED':'A CITY FULL OF STORIES'}</div></header>
  {error&&<div className="error-banner"><AlertOctagon size={16}/><span>{error}</span><button onClick={()=>setError('')}>Dismiss</button></div>}
  <section className="landing-hero"><div className="landing-copy"><div className="eyebrow"><span className="red-dot"/> OLD TOWN · GOLDEN HOUR</div><h1>Come hungry.<br/><em>Leave with stories.</em></h1><p>Tell your character where to go, meet the people behind each counter, and talk about whatever comes to mind. The plaza remembers what matters to you.</p><button className="start-button" onClick={start} disabled={busy||stalls.length===0}><Play size={17} fill="currentColor"/>{busy?'OPENING THE PLAZA':'START YOUR EVENING'}<span>GIVE DIRECTIONS IN CHAT · WASD TO WANDER</span></button></div>
   <div className="landing-scene-card"><div className="landing-scene-art"><div className="art-sun"/><div className="art-lantern lantern-a"/><div className="art-lantern lantern-b"/><div className="art-stall-row">{['🥟','🥞','🍲','🫓','🍨'].map((food,i)=><div className={`art-stall art-stall-${i}`} key={food}><span>{food}</span><i/></div>)}</div><div className="art-ground"/><div className="art-caption"><span>OLD TOWN FOOD PLAZA</span><small>18 COUNTERS · ONE LONG EVENING</small></div></div><div className="scene-card-foot"><span><i className="live-pip"/> PEOPLE TO MEET</span><span>TAKE YOUR TIME</span></div></div>
  </section>
  <section className="landing-stats"><article><span className="stat-icon"><Store size={17}/></span><div><b>{stalls.length||18}</b><small>LOCAL FOOD STALLS</small></div></article><article><span className="stat-icon"><Users size={17}/></span><div><b>{stalls.length||18}</b><small>PEOPLE BEHIND THE COUNTERS</small></div></article><article><span className="stat-icon"><MessageCircle size={17}/></span><div><b>{allMessages.filter(m=>m.role==='player').length}</b><small>THINGS YOU'VE SHARED</small></div></article><article><span className="stat-icon"><Sparkles size={17}/></span><div><b>{memories.length}</b><small>DETAILS THEY REMEMBER</small></div></article></section>
  <footer className="landing-footer"><span>AN EVENING AT YOUR OWN PACE</span><span>GEMINI POWERED CONVERSATIONS · SAVED MEMORIES · VOICE CHAT</span></footer>
 </main>;

 return <main className="game-fullscreen">
  <div className="game-world"><Suspense fallback={<div className="scene-loading">Setting up the evening market…</div>}><GameScene stalls={stalls} onTalk={selectStall} activeId={activeId} onArrive={arrive}/></Suspense></div>
  <aside className="game-sidebar"><div className="game-sidebar-top"><button className="back-button" onClick={finish}><ArrowLeft size={15}/> PLAZA HOME</button><div className={`connection ${online?'online':''}`}>{online?<Wifi size={13}/>:<WifiOff size={13}/>} {online?'SAVED VISIT':'LOCAL VISIT'}</div></div>
   <div className="sidebar-context"><div className="eyebrow">{activeStall?(arrivalId===activeId?'AT THE COUNTER':'ON YOUR WAY'):'YOUR EVENING'}</div><h1>{activeStall?activeStall.food:'Where should we go?'}</h1><p>{activeStall?`${activeStall.vendor} · ${activeStall.description}`:'Tell me what you’re in the mood for, name a stall, or ask me anything. I’ll get you there.'}</p><div className="sidebar-tags"><span>{activeStall?activeStall.vendor.toUpperCase():'18 STALLS'}</span><span>{provider==='llm'?'GEMINI GAME DIRECTOR':'PERSONAL STORIES'}</span></div>{activeStall&&<div className={`travel-status ${arrivalId===activeId?'arrived':''}`}>{arrivalId===activeId?'YOU MADE IT · SAY HELLO':`WALKING TO ${activeStall.food.toUpperCase()}…`}</div>}</div>
   <DialoguePanel messages={messages} onSend={send} busy={busy} stall={activeStall}/>
   <div className="memory-peek"><span><Sparkles size={14}/> PLAZA MEMORY</span><b>{memories.length?memories[memories.length-1].claim_text:'Share a little about yourself. The vendors will remember.'}</b></div>
   {error&&<div className="sidebar-error"><AlertOctagon size={14}/>{error}</div>}
   <div className="game-controls"><span>WASD <small>WALK</small></span><span>SPACE <small>HOLD TO TALK</small></span><span>{gameState.visited?.length||0} <small>VISITED</small></span></div>
  </aside>
  <div className="game-brand"><b>REMNANT</b><span>OLD TOWN FOOD PLAZA</span></div>
 </main>;
}

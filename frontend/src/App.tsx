import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertOctagon, PanelLeftClose, PanelLeftOpen, Compass, LoaderCircle, Play, Sparkles, Store, Users, MessageCircle, Wifi, WifiOff, Coins, ShoppingCart, Receipt as ReceiptIcon, Utensils, CheckCircle2, Music } from 'lucide-react';
import type { Stall } from './scene/GameScene';
import DialoguePanel, { type ChatItem } from './components/DialoguePanel';
import CognitiveInspector from './components/CognitiveInspector';
import ShopPanel from './components/ShopPanel';
import { plazaAudio } from './audio/PlazaAudio';
import { api } from './api/client';
import type { Conflict, Memory, Session, Cart, Receipt, Wallet } from './types';

const GameScene=lazy(()=>import('./scene/GameScene'));

export default function App(){
 const [session,setSession]=useState<Session|null>(null);
 const [stalls,setStalls]=useState<Stall[]>([]);
 const [activeId,setActiveId]=useState('');
 const [messages,setMessages]=useState<ChatItem[]>([]);
 const [allMessages,setAllMessages]=useState<ChatItem[]>([]);
 const [memories,setMemories]=useState<Memory[]>([]);
 const [conflicts,setConflicts]=useState<Conflict[]>([]);
 const [wallet,setWallet]=useState<Wallet|null>({balance:500,currency:'INR',symbol:'₹'});
 const [cart,setCart]=useState<Cart|null>(null);
 const [orders,setOrders]=useState<Receipt[]>([]);
 const [shopMode,setShopMode]=useState<'catalog'|'cart'|'receipts'|null>(null);
 const [latestReceipt,setLatestReceipt]=useState<Receipt|null>(null);
 const [ambientAudio,setAmbientAudio]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [online,setOnline]=useState(false);
 const [provider,setProvider]=useState('');
 const [arrivalId,setArrivalId]=useState('');
 const [gameStarted,setGameStarted]=useState(false);
 const [sidebarMinimized,setSidebarMinimized]=useState(false);
 const activeStall=useMemo(()=>stalls.find(stall=>stall.id===activeId)||null,[stalls,activeId]);
 const toChat=(items:Array<{role:string;speaker:string|null;content:string}>,speakLast=false):ChatItem[]=>items.map((x,index)=>({role:x.role as ChatItem['role'],speaker:x.speaker,content:x.content,shouldSpeak:speakLast&&index===items.length-1&&x.role!=='player'}));

 const refresh=useCallback(async(id:string,npcId='')=>{
  try{
   const [s,m,ch,w,c,ord]=await Promise.all([
     api.session(id),
     api.memories(id),
     api.messages(id,npcId),
     api.wallet(id).catch(()=>({balance:500,currency:'INR',symbol:'₹'})),
     api.cart(id,npcId).catch(()=>null),
     api.orders(id).catch(()=>({orders:[]})),
   ]);
   setSession(s);setMemories(m.memories);setConflicts(m.conflicts);
   if(w)setWallet(w);
   if(c)setCart(c);
   if(ord?.orders)setOrders(ord.orders);
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
  try{
    await ensureSession();
    setActiveId('');
    setMessages([]);
    setSidebarMinimized(true);
    setGameStarted(true);
    plazaAudio.start();
    setAmbientAudio(true);
  }
  catch(e){setOnline(false);setError(e instanceof Error?e.message:'Could not connect to the plaza')}
  finally{setBusy(false)}
 };
 const selectStall=(id:string)=>{
  setActiveId(id);setArrivalId('');
  if(session){
    api.messages(session.session_id,id).then(result=>setMessages(toChat(result.messages))).catch(()=>setMessages([]));
    api.cart(session.session_id,id).then(c=>setCart(c)).catch(()=>{});
  }
 };
 const send=async(message:string)=>{
  if(!session)return;
  setBusy(true);setError('');setMessages(old=>[...old,{role:'player',content:message}]);
  try{
   const result=await api.interact(session.session_id,message,activeId);
   setProvider(result.provider);
   if(result.cart)setCart(result.cart);
   if(result.wallet)setWallet(result.wallet);
   if(result.receipt){
     setOrders(prev=>[result.receipt!,...prev]);
     setLatestReceipt(result.receipt);
   }
   if(result.action?.type==='navigate'&&result.action.stall_id){
    const target=result.action.stall_id;setActiveId(target);setArrivalId('');
    const thread=await api.messages(session.session_id,target);setMessages(toChat(thread.messages,true));
   }else{
    const target=result.action?.stall_id||activeId;
    if(target&&target!==activeId){setActiveId(target);setArrivalId('')}
    const thread=await api.messages(session.session_id,target);
    setMessages(toChat(thread.messages,true));
   }
   await refresh(session.session_id, activeId);
  }catch(e){setError(e instanceof Error?e.message:'Conversation failed');setMessages(old=>[...old,{role:'aria',speaker:'Plaza guide',content:'I lost the plaza signal for a moment. Try that again?'}])}
  finally{setBusy(false)}
 };
 const arrive=(id:string)=>setArrivalId(id);
 const gameState=session?.game_state||{game:'after_hours_city',place:'Old Town Square',visited:[],status:'roaming',last_event:'The evening lights are coming on.'};
 const finish=()=>{setGameStarted(false);setActiveId('');plazaAudio.stop();setAmbientAudio(false);if(session)refresh(session.session_id)};

 if(!gameStarted)return <main className="landing-screen">
  <header className="landing-topbar"><div className="brand"><div className="brand-mark"><Compass size={20}/></div><div><strong>PROJECT <span>REMNANT</span></strong><small>AFTER HOURS · FOOD PLAZA</small></div></div><div className={`landing-link ${online?'online':''}`}>{online?<Wifi size={14}/>:<WifiOff size={14}/>} {online?'YOUR EVENING IS SAVED':'A CITY FULL OF STORIES'}</div></header>
  {error&&<div className="error-banner"><AlertOctagon size={16}/><span>{error}</span><button onClick={()=>setError('')}>Dismiss</button></div>}
  <section className="landing-hero"><div className="landing-copy"><div className="eyebrow"><span className="red-dot"/> OLD TOWN · GOLDEN HOUR</div><h1>Come hungry.<br/><em>Leave with stories.</em></h1><p>Tell your character where to go, meet the people behind each counter, and talk about whatever comes to mind. The plaza remembers what matters to you.</p><button className="start-button" onClick={start} disabled={busy||stalls.length===0}>{busy?<LoaderCircle size={17} className="spin"/>:<Play size={17} fill="currentColor"/>}{busy?'OPENING THE PLAZA':stalls.length===0?'LOADING THE PLAZA':'START YOUR EVENING'}<span>GIVE DIRECTIONS IN CHAT · WASD TO WANDER</span></button></div>
   <div className="landing-scene-card"><div className="landing-scene-art"><div className="art-sun"/><div className="art-lantern lantern-a"/><div className="art-lantern lantern-b"/><div className="art-stall-row">{['🥟','🥞','🍲','🫓','🍨'].map((food,i)=><div className={`art-stall art-stall-${i}`} key={food}><span>{food}</span><i/></div>)}</div><div className="art-ground"/><div className="art-caption"><span>OLD TOWN FOOD PLAZA</span><small>18 COUNTERS · ONE LONG EVENING</small></div></div><div className="scene-card-foot"><span><i className="live-pip"/> PEOPLE TO MEET</span><span>TAKE YOUR TIME</span></div></div>
  </section>
  <section className="landing-stats"><article><span className="stat-icon"><Store size={17}/></span><div><b>{stalls.length||18}</b><small>LOCAL FOOD STALLS</small></div></article><article><span className="stat-icon"><Users size={17}/></span><div><b>{stalls.length||18}</b><small>PEOPLE BEHIND THE COUNTERS</small></div></article><article><span className="stat-icon"><MessageCircle size={17}/></span><div><b>{allMessages.filter(m=>m.role==='player').length}</b><small>THINGS YOU'VE SHARED</small></div></article><article><span className="stat-icon"><Sparkles size={17}/></span><div><b>{memories.length}</b><small>DETAILS THEY REMEMBER</small></div></article></section>
  <footer className="landing-footer"><span>AN EVENING AT YOUR OWN PACE</span><span>LOCAL QWEN LLM · CONVERSATIONAL COMMERCE · SAVED MEMORIES</span></footer>
 </main>;

 return <main className="game-fullscreen">
  <div className="game-world"><Suspense fallback={<div className="scene-loading">Setting up the evening market…</div>}><GameScene stalls={stalls} onTalk={selectStall} activeId={activeId} onArrive={arrive}/></Suspense></div>
  <aside className={`game-sidebar ${sidebarMinimized?'sidebar-minimized':''}`} aria-label="Plaza game controls">
   {sidebarMinimized&&<div className="sidebar-restore-row"><button className="back-button sidebar-home" onClick={finish}><ArrowLeft size={15}/> PLAZA HOME</button><button className="sidebar-expand" onClick={()=>setSidebarMinimized(false)} aria-label="Expand plaza sidebar" title="Expand sidebar"><PanelLeftOpen size={15}/></button></div>}
   <div className="sidebar-content">
    <div className="game-sidebar-top">
      <button className="back-button" onClick={finish}><ArrowLeft size={15}/> PLAZA HOME</button>
      <div className="commerce-hud">
        <button className={`hud-chip audio-chip ${ambientAudio ? 'active' : ''}`} onClick={()=>setAmbientAudio(plazaAudio.toggle())} title="Dusk Plaza Background Ambient Music"><Music size={13}/> {ambientAudio ? 'MUSIC ON' : 'MUSIC OFF'}</button>
        <button className="hud-chip wallet-chip" onClick={()=>setShopMode('cart')} title="Wallet Balance"><Coins size={13}/> ₹{wallet?.balance ?? 500}</button>
        <button className={`hud-chip cart-chip ${cart?.items?.length ? 'has-items' : ''}`} onClick={()=>setShopMode('cart')} title="View Order Cart"><ShoppingCart size={13}/> {cart?.items?.length || 0} {cart?.total ? `· ₹${cart.total}` : ''}</button>
        <button className="hud-chip receipts-chip" onClick={()=>setShopMode('receipts')} title="Order Receipts"><ReceiptIcon size={13}/> {orders.length}</button>
      </div>
      <button className="sidebar-minimize" onClick={()=>setSidebarMinimized(true)} aria-label="Minimize sidebar" title="Minimize sidebar"><PanelLeftClose size={15}/></button>
    </div>
    <div className="sidebar-context">
      <div className="eyebrow">{activeStall?(arrivalId===activeId?'AT THE COUNTER':'ON YOUR WAY'):'YOUR EVENING'}</div>
      <h1>{activeStall?activeStall.food:'Where should we go?'}</h1>
      <p>{activeStall?`${activeStall.vendor} · ${activeStall.description}`:'Tell me what you’re in the mood for, order dishes directly, negotiate prices, or ask me anything.'}</p>
      {activeStall&&<div className="stall-commerce-actions">
        <button className="stall-action-btn menu-btn" onClick={()=>setShopMode('catalog')}><Utensils size={14}/> STALL MENU (₹)</button>
        <button className="stall-action-btn cart-btn" onClick={()=>setShopMode('cart')}><ShoppingCart size={14}/> CART ({cart?.items?.length||0})</button>
      </div>}
      <div className="sidebar-tags"><span>{activeStall?activeStall.vendor.toUpperCase():'18 STALLS'}</span><span>{provider==='llm'?'LOCAL QWEN LLM':'OFFLINE FALLBACK'}</span></div>
      {activeStall&&<div className={`travel-status ${arrivalId===activeId?'arrived':''}`}>{arrivalId===activeId?'YOU MADE IT · SAY HELLO':`WALKING TO ${activeStall.food.toUpperCase()}…`}</div>}
    </div>

    {latestReceipt&&<div className="order-toast">
      <CheckCircle2 size={16} className="toast-icon"/>
      <div className="toast-copy"><b>Order Confirmed!</b><small>#{latestReceipt.order_id} · Paid ₹{latestReceipt.total}</small></div>
      <button className="view-receipt-btn" onClick={()=>{setShopMode('receipts');setLatestReceipt(null)}}>Receipt</button>
      <button className="toast-close" onClick={()=>setLatestReceipt(null)}>✕</button>
    </div>}

    <DialoguePanel messages={messages} onSend={send} busy={busy} stall={activeStall}/>
    <div className="memory-peek"><span><Sparkles size={14}/> PLAZA MEMORY</span><b>{memories.length?memories[memories.length-1].claim_text:'Share a little about yourself or order your favorites. The vendors will remember.'}</b></div>
    {error&&<div className="sidebar-error"><AlertOctagon size={14}/>{error}</div>}
    <div className="game-controls"><span>A / D <small>STEER</small></span><span>W / UP <small>WALK</small></span><span>SPACE <small>TALK</small></span><span>₹{wallet?.balance ?? 500} <small>WALLET</small></span><span>{gameState.visited?.length||0} <small>VISITED</small></span></div>
   </div>
  </aside>
  <div className="game-brand"><b>REMNANT</b><span>OLD TOWN FOOD PLAZA</span></div>

  <ShopPanel
    sessionId={session?.session_id || ''}
    activeStall={activeStall}
    wallet={wallet}
    cart={cart}
    orders={orders}
    viewMode={shopMode}
    onClose={()=>setShopMode(null)}
    onOpenMode={(m)=>setShopMode(m)}
    onCartUpdated={(c)=>setCart(c)}
    onOrderPlaced={(rec, rem)=>{
      setOrders(prev=>[rec,...prev]);
      setLatestReceipt(rec);
      if(rem!==undefined)setWallet(w=>w?{...w,balance:rem}:{balance:rem,currency:'INR',symbol:'₹'});
    }}
  />
 </main>;
}

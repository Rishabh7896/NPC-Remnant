import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Bot, UserRound, Volume2, Mic, AudioLines, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { Stall } from '../scene/GameScene';
import { plazaAudio } from '../audio/PlazaAudio';

export type ChatItem = {role:'player'|'aria'|'npc';speaker?:string|null;content:string;shouldSpeak?:boolean};
type RecognitionResultEvent = Event & { results:ArrayLike<ArrayLike<{transcript:string;isFinal:boolean}>>;resultIndex:number };
type Recognition = {lang:string;continuous:boolean;interimResults:boolean;onresult:((event:Event)=>void)|null;onerror:((event:Event)=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
type RecognitionConstructor = new()=>Recognition;

const STALL_EMOJIS: Record<string, string> = {
  'pani-puri': '🥟', 'chaat': '🍲', 'masala-dosa': '🥞', 'idli-sambar': '🍛',
  'vada-pav': '🍔', 'pav-bhaji': '🥘', 'jalebi': '🥨', 'chai': '☕',
  'momos': '🥟', 'kathi-roll': '🌯', 'kulfi': '🍨', 'biryani': '🍚',
  'lassi': '🥛', 'dhokla': '🧽', 'poha': '🥣', 'uttapam': '🥞',
  'paratha': '🫓', 'filter-coffee': '☕',
};

const VENDOR_COOKING_ACTIONS: Record<string, string[]> = {
  'pani-puri': ["Rani is cracking open crisp puris with chilled mint water…", "Balancing sweet tamarind and teekha spiced pani…", "Sprinkling roasted jeera and boondi…"],
  'chaat': ["Iqbal is sizzling spiced aloo tikki on the hot griddle…", "Drizzling sonth and chilled whipped curd…", "Adding roasted cumin and crunchy sev…"],
  'masala-dosa': ["Lakshmi is spreading fermented batter across the golden tawa…", "Folding around turmeric potato masala and pure butter…", "Plating the crisp dosa with fresh coconut chutney…"],
  'idli-sambar': ["Meena is opening the steaming idli pot…", "Ladling hot drumstick sambar with fresh curry leaves…", "Plating fluffy idlis with coconut chutney…"],
  'vada-pav': ["Arjun is tossing fiery dry garlic chutney onto buttered pav…", "Placing a hot golden batata vada inside…", "Adding salted fried green chilies…"],
  'pav-bhaji': ["Farida is mashing vegetables on the sizzling tawa…", "Adding generous slabs of melting Amul butter…", "Toasting soft pavs till golden brown…"],
  'jalebi': ["Kavita is piping circular coils into hot ghee…", "Soaking crisp coils in fragrant saffron sugar syrup…", "Garnishing with crushed cardamom and pistachios…"],
  'chai': ["Babu is crushing fresh ginger and green cardamom…", "Boiling strong CTC tea leaves with fresh milk…", "High-pouring cutting chai into glass tumblers…"],
  'momos': ["Tenzin is hand-pleating dumplings in the bamboo steamer…", "Lifting the lid to aromatic Himalayan steam…", "Ladle-scooping fiery red garlic-chili dip…"],
  'kathi-roll': ["Sana is grilling layered paratha on the tawa…", "Rolling charred spiced paneer and sliced onions…", "Drizzling fresh mint chutney and chaat masala…"],
  'kulfi': ["Harish is pulling dense malai kulfi from the clay matka…", "Slicing royal pistachio kulfi over ice…", "Drizzling chilled rose syrup and falooda…"],
  'biryani': ["Zoya is cutting the dough seal on the dum handi…", "Releasing fragrant saffron and whole spice steam…", "Portioning aged basmati rice with cold boondi raita…"],
  'lassi': ["Gurpreet is churning sweet curd with a wooden madhani…", "Pouring thick frothy lassi into a chilled kulhad…", "Crowning with a thick layer of fresh clotted malai…"],
  'dhokla': ["Hetal is slicing spongy yellow khaman cakes…", "Tempering mustard seeds and green chilies in hot oil…", "Garnishing with freshly chopped coriander…"],
  'poha': ["Ramesh is steaming turmeric flattened rice with fennel…", "Topping with spicy Ratlami sev and fresh pomegranate…", "Squeezing a fresh slice of lemon…"],
  'uttapam': ["Anand is caramelizing chopped onions on the thick rice pancake…", "Brushing the edges with fragrant hot ghee…", "Pairing with tomato and coconut chutneys…"],
  'paratha': ["Simran is rolling whole wheat dough with spiced potato filling…", "Griddling the paratha till golden and crisp…", "Serving hot with a big dollop of white makhan and pickle…"],
  'filter-coffee': ["Karthik is brewing dark chicory decoction…", "Frothing boiled milk and coffee between brass tumblers…", "Pouring with a rich golden foam crown…"],
};

export default function DialoguePanel({messages,onSend,busy,stall}:{messages:ChatItem[];onSend:(message:string)=>void;busy:boolean;stall:Stall|null}) {
 const [value,setValue]=useState('');
 const [recording,setRecording]=useState(false);
 const [voiceError,setVoiceError]=useState('');
 const [autoSpeak,setAutoSpeak]=useState(true);
 const [transcriptMinimized,setTranscriptMinimized]=useState(false);
 const [cookingIndex,setCookingIndex]=useState(0);

 useEffect(()=>{
  if(!busy){setCookingIndex(0);return;}
  const timer=setInterval(()=>setCookingIndex(i=>(i+1)%3),2000);
  return()=>clearInterval(timer);
 },[busy]);
 const recognitionRef=useRef<Recognition|null>(null);
 const recordingRef=useRef(false);
 const pushToTalkRef=useRef(false);
 const restartAllowedRef=useRef(false);
 const finalSegmentsRef=useRef<string[]>([]);
 const resultBaseRef=useRef(0);
 const finalTranscript=useRef('');
 const draftTranscript=useRef('');
 const submitAfterStop=useRef(false);
 const submit=(e?:React.FormEvent)=>{e?.preventDefault();const text=value.trim();if(text&&!busy){onSend(text);setValue('')}};
 const beginRecording=useCallback(()=>{
  if(recognitionRef.current||pushToTalkRef.current)return;
  setVoiceError('');finalTranscript.current='';draftTranscript.current='';finalSegmentsRef.current=[];resultBaseRef.current=0;submitAfterStop.current=false;
  const speechWindow=window as Window&{SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};
  const Speech=speechWindow.SpeechRecognition||speechWindow.webkitSpeechRecognition;
  if(!Speech){setVoiceError('Voice input needs Chrome or Edge. You can still type here.');return}
  pushToTalkRef.current=true;restartAllowedRef.current=true;
  plazaAudio.setDucking(true);
  window.speechSynthesis?.cancel();
  const recognition=new Speech();recognition.lang=navigator.language||'en-IN';recognition.continuous=true;recognition.interimResults=true;
  recognition.onresult=(event)=>{
   const results=(event as RecognitionResultEvent).results;
   const resultIndex=(event as RecognitionResultEvent).resultIndex||0;
   for(let i=resultIndex;i<results.length;i++){
    const result=results[i]?.[0];
    if(result?.isFinal)finalSegmentsRef.current[resultBaseRef.current+i]=result.transcript.trim();
   }
   finalTranscript.current=finalSegmentsRef.current.filter(Boolean).join(' ').trim();
   const interim=Array.from(results).filter(result=>!result[0]?.isFinal).map(result=>result[0]?.transcript||'').join(' ').trim();
   draftTranscript.current=[finalTranscript.current,interim].filter(Boolean).join(' ').trim();
   setValue(draftTranscript.current);
  };
  recognition.onerror=(event)=>{const error=(event as Event&{error?:string}).error;restartAllowedRef.current=false;recordingRef.current=false;setRecording(false);setVoiceError(error==='not-allowed'?'Allow microphone access to use voice input.':'Voice input stopped. Release Space to send what was heard.')};
  recognition.onend=()=>{
   recognitionRef.current=null;
   if(submitAfterStop.current){recordingRef.current=false;setRecording(false);const text=finalTranscript.current.trim()||draftTranscript.current.trim();if(text&&!busy){onSend(text);setValue('')}submitAfterStop.current=false;return}
   if(pushToTalkRef.current&&restartAllowedRef.current){
    resultBaseRef.current=finalSegmentsRef.current.length;
    window.setTimeout(()=>{
     if(!pushToTalkRef.current||!restartAllowedRef.current)return;
     try{recognition.start();recognitionRef.current=recognition;recordingRef.current=true;setRecording(true)}
     catch{recordingRef.current=false;restartAllowedRef.current=false;setRecording(false);setVoiceError('Voice input stopped. Release Space to send what was heard.')}
    },120);
    return;
   }
   recordingRef.current=false;setRecording(false);
  };
  recognitionRef.current=recognition;recordingRef.current=true;setRecording(true);
  try{recognition.start()}catch{recognitionRef.current=null;recordingRef.current=false;pushToTalkRef.current=false;restartAllowedRef.current=false;setRecording(false);setVoiceError('Could not start the microphone. Try again.')}
 },[busy,onSend]);
 const endRecording=useCallback(()=>{
  if(!pushToTalkRef.current)return;
  pushToTalkRef.current=false;
  submitAfterStop.current=true;
  plazaAudio.setDucking(false);
  if(recognitionRef.current){try{recognitionRef.current.stop()}catch{recognitionRef.current=null;recordingRef.current=false;restartAllowedRef.current=false;setRecording(false);const text=finalTranscript.current.trim()||draftTranscript.current.trim();if(submitAfterStop.current&&text&&!busy){onSend(text);setValue('')}submitAfterStop.current=false}}
  else{recordingRef.current=false;restartAllowedRef.current=false;setRecording(false);const text=finalTranscript.current.trim()||draftTranscript.current.trim();if(text&&!busy){onSend(text);setValue('')}submitAfterStop.current=false}
 },[busy,onSend]);
 useEffect(()=>{
  const down=(event:KeyboardEvent)=>{
   if(event.code!=='Space'||event.repeat)return;
   const target=event.target as HTMLElement|null;
   if(target?.isContentEditable||['INPUT','TEXTAREA'].includes(target?.tagName||''))return;
   event.preventDefault();beginRecording();
  };
  const up=(event:KeyboardEvent)=>{if(event.code==='Space'&&pushToTalkRef.current){event.preventDefault();endRecording()}};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);
  window.addEventListener('blur',endRecording);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',endRecording)};
 },[beginRecording,endRecording]);
 const getIndianVoice=()=>{
  if(!('speechSynthesis'in window))return null;
  const voices=window.speechSynthesis.getVoices();
  return (
    voices.find(v=>v.lang==='en-IN'||v.lang==='en_IN') ||
    voices.find(v=>v.lang.startsWith('hi')||v.name.toLowerCase().includes('india')) ||
    voices.find(v=>v.lang.startsWith('en')) ||
    null
  );
 };

 const speak=(text:string)=>{
  if(!('speechSynthesis'in window))return;
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  const voice=getIndianVoice();
  if(voice)utterance.voice=voice;
  utterance.lang='en-IN';
  utterance.rate=1.0;
  utterance.pitch=1.03;
  utterance.onstart=()=>plazaAudio.setDucking(true);
  utterance.onend=()=>plazaAudio.setDucking(false);
  utterance.onerror=()=>plazaAudio.setDucking(false);
  window.speechSynthesis.speak(utterance);
 };

 useEffect(()=>{
  const latest=messages[messages.length-1];
  if(!autoSpeak||!latest?.shouldSpeak||!['npc','aria'].includes(latest.role))return;
  speak(latest.content);
 },[messages,autoSpeak]);
 useEffect(()=>{if(!autoSpeak&&'speechSynthesis'in window)window.speechSynthesis.cancel()},[autoSpeak]);
 useEffect(()=>()=>{pushToTalkRef.current=false;recordingRef.current=false;restartAllowedRef.current=false;recognitionRef.current?.stop();if('speechSynthesis'in window)window.speechSynthesis.cancel()},[]);

 const stallActionList=stall?VENDOR_COOKING_ACTIONS[stall.id]||["Preparing fresh ingredients on the counter…","Checking spices and recipes…","Finishing your order in character…"]:["Tuning in to the food plaza…","Checking recent conversations…","Crafting the scene…"];
 const currentActionText=stallActionList[cookingIndex%stallActionList.length];

 return <section className={`panel dialogue-panel ${transcriptMinimized?'transcript-minimized':''} ${recording?'listening-active':''}`}>
  {recording&&(
    <div className="active-listening-banner">
      <div className="listening-pulse-ring">
        <div className="pulse-circle pulse-1"/>
        <div className="pulse-circle pulse-2"/>
        <Mic size={18} className="pulsing-mic-icon"/>
      </div>
      <div className="listening-info">
        <div className="listening-header">
          <span className="live-rec-dot"/>
          <b>LISTENING TO YOU…</b>
          <span className="rec-hint">Release Space to send</span>
        </div>
        <div className="wave-bars">
          <span className="bar bar-1"/><span className="bar bar-2"/><span className="bar bar-3"/>
          <span className="bar bar-4"/><span className="bar bar-5"/><span className="bar bar-6"/><span className="bar bar-7"/>
        </div>
        {value.trim()?(
          <p className="interim-text">“{value}”</p>
        ):(
          <p className="interim-prompt">Speak naturally: order food, ask about dishes, or bargain…</p>
        )}
      </div>
    </div>
  )}

  <div className="panel-heading"><div><span className="eyebrow">PLAZA COMMS{transcriptMinimized?` · ${messages.length} MESSAGES`:''}</span><h2>{stall?`With ${stall.vendor}`:'Tell me where to go'}</h2></div><div className="comms-actions"><button className={`voice-toggle ${autoSpeak?'active':''}`} onClick={()=>setAutoSpeak(value=>!value)} title={autoSpeak?'Turn spoken replies off':'Turn spoken replies on'}><Volume2 size={15}/><span>{autoSpeak?'VOICE ON':'VOICE OFF'}</span></button><button className="transcript-toggle" onClick={()=>setTranscriptMinimized(value=>!value)} aria-expanded={!transcriptMinimized} aria-label={transcriptMinimized?'Expand chat transcript':'Minimize chat transcript'} title={transcriptMinimized?'Expand transcript':'Minimize transcript'}>{transcriptMinimized?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button></div></div>
  {!transcriptMinimized&&<>
    <p className="conversation-note">Ask to visit a stall, find a food, or just talk. The plaza remembers your story.</p>
    <div className="chat-log">
      {messages.map((m,i)=>(
        <div className={`chat-row ${m.role}`} key={`${m.speaker||m.role}-${i}`}>
          <div className="chat-avatar">{m.role==='player'?<UserRound size={16}/>:<Bot size={16}/>}</div>
          <div className="chat-copy">
            <div className="chat-name">
              {m.role==='player'?'YOU':m.role==='aria'?(m.speaker||'PLAZA GUIDE'):m.speaker||stall?.vendor||'VENDOR'}
              {m.role!=='player'&&<button className="speak-button" onClick={()=>speak(m.content)} aria-label="Read message aloud" title="Read aloud"><Volume2 size={13}/></button>}
            </div>
            <p>{m.content}</p>
          </div>
        </div>
      ))}

      {messages.length===0&&!busy&&<><div className="empty-state">{stall?`Talk naturally with ${stall.vendor}. Ask about ${stall.food}, negotiate prices, or place an order!`:'Try “Take me to the masala dosa stall,” “I’m craving something spicy,” or “How was your day?”'}</div><div className="suggestions">{stall?<>
        <button type="button" onClick={()=>onSend('What do you recommend?')} disabled={busy}>Recommend</button>
        <button type="button" onClick={()=>onSend(`Can I order ${stall.food}?`)} disabled={busy}>Order {stall.food}</button>
        <button type="button" onClick={()=>onSend('Can you give me a discount?')} disabled={busy}>Discount</button>
        <button type="button" onClick={()=>onSend('Yes, place the order')} disabled={busy}>Confirm</button>
      </>:<>
        <button type="button" onClick={()=>onSend('Take me to the masala dosa stall')} disabled={busy}>Masala dosa</button>
        <button type="button" onClick={()=>onSend('Find me something spicy')} disabled={busy}>Something spicy</button>
        <button type="button" onClick={()=>onSend('Surprise me')} disabled={busy}>Surprise me</button>
      </>}</div></>}

      {busy&&(
        <div className="vendor-cooking-loader">
          <div className="cooking-avatar">
            <span className="cooking-emoji">{stall?STALL_EMOJIS[stall.id]||'🍲':'✨'}</span>
            <span className="cooking-steam">♨</span>
          </div>
          <div className="cooking-details">
            <div className="cooking-title">
              <b>{stall?stall.vendor:'Plaza Guide'}</b>
              <span className="cooking-status-tag"><Sparkles size={11}/> PREPARING</span>
            </div>
            <p className="cooking-action-text">{currentActionText}</p>
            <div className="bouncing-dots">
              <span className="dot dot-1"/><span className="dot dot-2"/><span className="dot dot-3"/>
            </div>
          </div>
        </div>
      )}
    </div>
  </>}
  <div className={`voice-status ${recording?'recording':''}`}><AudioLines size={14}/><span>{recording?'Listening… release Space to send':voiceError||'Hold Space to speak · release sends · replies read aloud'}</span><kbd>HOLD SPACE</kbd></div>
  <form className="chat-form" onSubmit={submit}><input value={value} onChange={e=>setValue(e.target.value)} placeholder={stall?`Ask ${stall.vendor} or give me a new direction…`:'Give your character a direction…'} aria-label="Talk or direct your character" disabled={busy}/><button type="button" className={`mic-button ${recording?'recording':''}`} onPointerDown={e=>{e.preventDefault();beginRecording()}} onPointerUp={endRecording} onPointerLeave={endRecording} onContextMenu={e=>e.preventDefault()} aria-label="Hold to record" title="Hold to record"><Mic size={16}/></button><button aria-label="Send message" disabled={busy||!value.trim()}><Send size={17}/></button></form>
 </section>;
}

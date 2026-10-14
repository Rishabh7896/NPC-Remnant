import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Bot, UserRound, LoaderCircle, Volume2, Mic, AudioLines } from 'lucide-react';
import type { Stall } from '../scene/GameScene';

export type ChatItem = {role:'player'|'aria'|'npc';speaker?:string|null;content:string;shouldSpeak?:boolean};
type RecognitionResultEvent = Event & { results:ArrayLike<ArrayLike<{transcript:string;isFinal:boolean}>>;resultIndex:number };
type Recognition = {lang:string;continuous:boolean;interimResults:boolean;onresult:((event:Event)=>void)|null;onerror:((event:Event)=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
type RecognitionConstructor = new()=>Recognition;

export default function DialoguePanel({messages,onSend,busy,stall}:{messages:ChatItem[];onSend:(message:string)=>void;busy:boolean;stall:Stall|null}) {
 const [value,setValue]=useState('');
 const [recording,setRecording]=useState(false);
 const [voiceError,setVoiceError]=useState('');
 const [autoSpeak,setAutoSpeak]=useState(true);
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
 useEffect(()=>{
  const latest=messages[messages.length-1];
  if(!autoSpeak||!latest?.shouldSpeak||!['npc','aria'].includes(latest.role))return;
  if(!('speechSynthesis'in window))return;
  const utterance=new SpeechSynthesisUtterance(latest.content);utterance.rate=0.97;utterance.lang=navigator.language||'en-IN';
  window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);
 },[messages,autoSpeak]);
 const speak=(text:string)=>{if(!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang=navigator.language||'en-IN';window.speechSynthesis.speak(utterance)};
 useEffect(()=>{if(!autoSpeak&&'speechSynthesis'in window)window.speechSynthesis.cancel()},[autoSpeak]);
 useEffect(()=>()=>{pushToTalkRef.current=false;recordingRef.current=false;restartAllowedRef.current=false;recognitionRef.current?.stop();if('speechSynthesis'in window)window.speechSynthesis.cancel()},[]);
 return <section className="panel dialogue-panel">
  <div className="panel-heading"><div><span className="eyebrow">PLAZA COMMS</span><h2>{stall?`With ${stall.vendor}`:'Tell me where to go'}</h2></div><button className={`voice-toggle ${autoSpeak?'active':''}`} onClick={()=>setAutoSpeak(value=>!value)} title={autoSpeak?'Turn spoken replies off':'Turn spoken replies on'}><Volume2 size={15}/><span>{autoSpeak?'VOICE ON':'VOICE OFF'}</span></button></div>
  <p className="conversation-note">Ask to visit a stall, find a food, or just talk. The plaza remembers your story.</p>
  <div className="chat-log">{messages.map((m,i)=><div className={`chat-row ${m.role}`} key={`${m.speaker||m.role}-${i}`}><div className="chat-avatar">{m.role==='player'?<UserRound size={16}/>:<Bot size={16}/>}</div><div className="chat-copy"><div className="chat-name">{m.role==='player'?'YOU':m.role==='aria'?(m.speaker||'PLAZA GUIDE'):m.speaker||'VENDOR'}{m.role!=='player'&&<button className="speak-button" onClick={()=>speak(m.content)} aria-label="Read message aloud" title="Read aloud"><Volume2 size={13}/></button>}</div><p>{m.content}</p></div></div>)}{messages.length===0&&<><div className="empty-state">Try “Take me to the masala dosa stall,” “I’m craving something spicy,” or “How was your day?”</div><div className="suggestions"><button type="button" onClick={()=>onSend('Take me to the masala dosa stall')} disabled={busy}>Masala dosa</button><button type="button" onClick={()=>onSend('Find me something spicy')} disabled={busy}>Something spicy</button><button type="button" onClick={()=>onSend('Surprise me')} disabled={busy}>Surprise me</button></div></>}{busy&&<div className="thinking"><LoaderCircle size={15} className="spin"/> {stall?.vendor||'The plaza'} is figuring that out…</div>}</div>
  <div className={`voice-status ${recording?'recording':''}`}><AudioLines size={14}/><span>{recording?'Listening… release Space to send':voiceError||'Hold Space to speak · release sends · replies read aloud'}</span><kbd>HOLD SPACE</kbd></div>
  <form className="chat-form" onSubmit={submit}><input value={value} onChange={e=>setValue(e.target.value)} placeholder={stall?`Ask ${stall.vendor} or give me a new direction…`:'Give your character a direction…'} aria-label="Talk or direct your character" disabled={busy}/><button type="button" className={`mic-button ${recording?'recording':''}`} onPointerDown={e=>{e.preventDefault();beginRecording()}} onPointerUp={endRecording} onPointerLeave={endRecording} onContextMenu={e=>e.preventDefault()} aria-label="Hold to record" title="Hold to record"><Mic size={16}/></button><button aria-label="Send message" disabled={busy||!value.trim()}><Send size={17}/></button></form>
 </section>;
}

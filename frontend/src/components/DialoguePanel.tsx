import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Bot, UserRound, LoaderCircle, Volume2, VolumeX, Mic, AudioLines } from 'lucide-react';
import type { Stall } from '../scene/GameScene';

export type ChatItem = {role:'player'|'aria'|'npc';speaker?:string|null;content:string};
type RecognitionResultEvent = Event & { results:ArrayLike<ArrayLike<{transcript:string;isFinal:boolean}>> };
type Recognition = {lang:string;continuous:boolean;interimResults:boolean;onresult:((event:Event)=>void)|null;onerror:((event:Event)=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
type RecognitionConstructor = new()=>Recognition;

export default function DialoguePanel({messages,onSend,busy,stall}:{messages:ChatItem[];onSend:(message:string)=>void;busy:boolean;stall:Stall|null}) {
 const [value,setValue]=useState('');
 const [recording,setRecording]=useState(false);
 const [voiceError,setVoiceError]=useState('');
 const [autoSpeak,setAutoSpeak]=useState(true);
 const recognitionRef=useRef<Recognition|null>(null);
 const finalTranscript=useRef('');
 const submitAfterStop=useRef(false);
 const lastSpoken=useRef('');
 const inputRef=useRef<HTMLInputElement>(null);
 const submit=(e?:React.FormEvent)=>{e?.preventDefault();const text=value.trim();if(text&&!busy){onSend(text);setValue('')}};
 const beginRecording=useCallback(()=>{
  if(recognitionRef.current||recording)return;
  setVoiceError('');finalTranscript.current='';submitAfterStop.current=false;
  const speechWindow=window as Window&{SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};
  const Speech=speechWindow.SpeechRecognition||speechWindow.webkitSpeechRecognition;
  if(!Speech){setVoiceError('Voice input needs Chrome or Edge. You can still type here.');return}
  window.speechSynthesis?.cancel();
  const recognition=new Speech();recognition.lang=navigator.language||'en-IN';recognition.continuous=true;recognition.interimResults=true;
  recognition.onresult=(event)=>{
   const results=(event as RecognitionResultEvent).results;
   const all=Array.from(results).map(result=>result[0]?.transcript||'').join(' ').trim();
   finalTranscript.current=Array.from(results).filter(result=>result[0]?.isFinal).map(result=>result[0].transcript).join(' ').trim();
   setValue(all);
  };
  recognition.onerror=(event)=>{const error=(event as Event&{error?:string}).error;setVoiceError(error==='not-allowed'?'Allow microphone access to use voice input.':'Voice input stopped. Try holding Space again.')};
  recognition.onend=()=>{
   recognitionRef.current=null;setRecording(false);
   if(submitAfterStop.current){const text=finalTranscript.current.trim();if(text&&!busy){onSend(text);setValue('')}submitAfterStop.current=false}
  };
  recognitionRef.current=recognition;setRecording(true);
  try{recognition.start()}catch{recognitionRef.current=null;setRecording(false);setVoiceError('Could not start the microphone. Try again.')}
 },[busy,onSend,recording]);
 const endRecording=useCallback(()=>{
  if(!recording)return;
  submitAfterStop.current=true;
  if(recognitionRef.current){try{recognitionRef.current.stop()}catch{recognitionRef.current=null;setRecording(false)}}
  else{setRecording(false);const text=finalTranscript.current.trim();if(text&&!busy){onSend(text);setValue('')}submitAfterStop.current=false}
 },[busy,onSend,recording]);
 useEffect(()=>{
  const down=(event:KeyboardEvent)=>{
   if(event.code!=='Space'||event.repeat)return;
   const target=event.target as HTMLElement|null;
   if(target?.isContentEditable||['INPUT','TEXTAREA','BUTTON'].includes(target?.tagName||''))return;
   event.preventDefault();beginRecording();
  };
  const up=(event:KeyboardEvent)=>{if(event.code==='Space'&&recording){event.preventDefault();endRecording()}};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)};
 },[beginRecording,endRecording,recording]);
 useEffect(()=>{
  const latest=messages[messages.length-1];
  if(!autoSpeak||!latest||latest.role!=='npc'||latest.content===lastSpoken.current)return;
  if(!('speechSynthesis'in window))return;
  const utterance=new SpeechSynthesisUtterance(latest.content);utterance.rate=0.97;utterance.lang=navigator.language||'en-IN';
  lastSpoken.current=latest.content;window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);
 },[messages,autoSpeak]);
 const speak=(text:string)=>{if(!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang=navigator.language||'en-IN';window.speechSynthesis.speak(utterance)};
 return <section className="panel dialogue-panel">
  <div className="panel-heading"><div><span className="eyebrow">PLAZA CONVERSATION</span><h2>{stall?`Chat with ${stall.vendor}`:'Choose someone to talk to'}</h2></div><button className={`voice-toggle ${autoSpeak?'active':''}`} onClick={()=>setAutoSpeak(value=>!value)} title={autoSpeak?'Turn spoken replies off':'Turn spoken replies on'}><Volume2 size={15}/><span>{autoSpeak?'VOICE ON':'VOICE OFF'}</span></button></div>
  <p className="conversation-note">Your conversations are saved and used as context when vendors reply.</p>
  <div className="chat-log">{messages.map((m,i)=><div className={`chat-row ${m.role}`} key={`${m.speaker||m.role}-${i}`}><div className="chat-avatar">{m.role==='player'?<UserRound size={16}/>:<Bot size={16}/>}</div><div className="chat-copy"><div className="chat-name">{m.role==='player'?'YOU':m.role==='aria'?'ARIA':m.speaker||'VENDOR'}{m.role==='npc'&&<button className="speak-button" onClick={()=>speak(m.content)} aria-label="Read message aloud" title="Read aloud"><Volume2 size={13}/></button>}</div><p>{m.content}</p></div></div>)}{messages.length===0&&<div className="empty-state">Choose any stall and start with a greeting, a food question, or a story of your own.</div>}{busy&&<div className="thinking"><LoaderCircle size={15} className="spin"/> {stall?.vendor||'Your neighbor'} is thinking…</div>}</div>
  <div className="voice-status"><AudioLines size={14}/><span>{recording?'Listening… release Space to send':voiceError||'Hold Space to talk · replies are spoken aloud'}</span><kbd>SPACE</kbd></div>
  <form className="chat-form" onSubmit={submit}><input ref={inputRef} value={value} onChange={e=>setValue(e.target.value)} placeholder={stall?`Say something to ${stall.vendor}…`:'Select a stall to begin…'} aria-label="Message the selected vendor" disabled={!stall||busy}/><button type="button" className={`mic-button ${recording?'recording':''}`} onPointerDown={e=>{e.preventDefault();beginRecording()}} onPointerUp={endRecording} onPointerLeave={endRecording} onContextMenu={e=>e.preventDefault()} aria-label="Hold to record" title="Hold to record"><Mic size={16}/></button><button aria-label="Send message" disabled={!stall||busy||!value.trim()}><Send size={17}/></button></form>
 </section>;
}

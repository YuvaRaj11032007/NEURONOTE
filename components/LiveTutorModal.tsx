import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { createPcmBlob, decodeAudioData } from '../services/audioUtils';
import { Note, NoteType } from '../types';

interface LiveTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  subjectName: string;
  activeNote?: Note;
  viewState?: any; // e.g., slide number
}

const LiveTutorModal: React.FC<LiveTutorModalProps> = ({ isOpen, onClose, notes, subjectName, activeNote, viewState }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'permission-denied'>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 380, y: window.innerHeight - 250 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isSessionActive = useRef(false); // Track logic active state distinct from React state

  // Auto-minimize if opened while viewing a note
  useEffect(() => {
      if (isOpen && activeNote && status === 'idle') {
          setIsMinimized(true);
      }
  }, [isOpen, activeNote]);

  // Lifecycle Management with Debounce to prevent race conditions
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isOpen) {
      // Small delay to prevent double-firing in strict mode or rapid toggles
      timeoutId = setTimeout(() => startSession(), 200);
    } else {
      disconnect();
    }
    return () => {
       clearTimeout(timeoutId);
       disconnect();
    };
  }, [isOpen]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
      if (!isMinimized) return;
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  // Global mouse events for smooth dragging
  useEffect(() => {
      if (isDragging) {
          const onMove = (e: MouseEvent) => {
              if (!dragStartRef.current) return;
              const newX = e.clientX - dragStartRef.current.x;
              const newY = e.clientY - dragStartRef.current.y;
              const boundedX = Math.max(20, Math.min(window.innerWidth - 100, newX));
              const boundedY = Math.max(20, Math.min(window.innerHeight - 100, newY));
              setPosition({ x: boundedX, y: boundedY });
          };
          const onUp = () => {
              setIsDragging(false);
              dragStartRef.current = null;
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
          return () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
          }
      }
  }, [isDragging]);

  const startSession = async () => {
    // Prevent multiple connections
    if (sessionRef.current || status === 'connected' || status === 'connecting') return;

    try {
      setStatus('connecting');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // 1. Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      // 2. Get Microphone Stream (Handle Permissions)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch (permErr) {
        console.error("Microphone permission denied:", permErr);
        await disconnect('permission-denied');
        return;
      }

      // 3. Prepare System Instruction
      const contextParts = notes.map(n => {
          let contentDesc = "";
          if (n.type === NoteType.TEXT) {
             if (n.structuredData) {
                 contentDesc = `[PPTX Slides - ${n.fileName}]: Contains ${n.structuredData.length} slides.`;
                 n.structuredData.forEach((slide: any) => {
                     contentDesc += `\nSlide ${slide.index}: ${slide.content} ${slide.note ? `(Note: ${slide.note})` : ''}`;
                 });
             } else {
                 contentDesc = `[Text Note - ${n.fileName || 'Untitled'}]:\n${n.content}`;
             }
          } else {
              contentDesc = `[File - ${n.fileName} (${n.type})]: (Content not viewable by AI directly, ask user for details)`;
          }
          return contentDesc;
      });

      let userContext = "The user has opened the live tutor.";
      if (activeNote) {
          userContext = `The user is CURRENTLY viewing the file: "${activeNote.fileName}" (${activeNote.type}).`;
          if (activeNote.structuredData && viewState?.slide) {
              userContext += ` Specifically, they are looking at Slide ${viewState.slide}.`;
          }
      }

      const systemInstruction = `You are NeuroNote, a friendly, casual study buddy helping with "${subjectName}". 
           Here is our study material:
           ${contextParts.join('\n\n')}
           CURRENT CONTEXT: ${userContext}
           Instructions for your persona:
           1. Talk like a NORMAL PERSON. Be conversational, not robotic.
           2. Use natural fillers occasionally.
           3. If the user is viewing a specific file or slide, refer to it!
           4. Keep it back-and-forth.
           5. Start by saying "Hey! I'm ready to study. I see you've got ${activeNote ? activeNote.fileName : 'your notes'} open. What's up?"
           `;

      // 4. Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            isSessionActive.current = true;
            setStatus('connected');
            
            const ctx = inputAudioContextRef.current;
            if (!ctx || ctx.state === 'closed') return;

            const source = ctx.createMediaStreamSource(stream);
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              // Guard: Stop processing if session is gone or not active
              if (!sessionRef.current || !isSessionActive.current) return;
              
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              sessionPromise.then(session => {
                  // Double check inside the promise resolution
                  if (!isSessionActive.current) return;
                  try {
                    session.sendRealtimeInput({ media: pcmBlob });
                  } catch(err) {
                      // Silent fail if session closed in background
                  }
              }).catch(err => {
                  // Ignore errors from resolved session promise if we are disconnecting
                  if(isSessionActive.current) console.warn("Send input error:", err);
              });
            };

            source.connect(processor);
            processor.connect(ctx.destination);
          },
          onmessage: async (msg) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                setIsSpeaking(true);
                const ctx = outputAudioContextRef.current;
                
                // Guard: Context must be active
                if (!ctx || ctx.state === 'closed') return;
                
                if (ctx.state === 'suspended') await ctx.resume();

                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                try {
                    const audioBuffer = await decodeAudioData(
                        new Uint8Array(atob(base64Audio).split('').map(c => c.charCodeAt(0))), 
                        ctx
                    );

                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(ctx.destination);
                    
                    source.addEventListener('ended', () => {
                        sourcesRef.current.delete(source);
                        if (sourcesRef.current.size === 0) setTimeout(() => setIsSpeaking(false), 200);
                    });

                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    sourcesRef.current.add(source);
                } catch (decodeErr) {
                    console.warn("Audio decode error", decodeErr);
                }
            }

            if (msg.serverContent?.interrupted) {
                 sourcesRef.current.forEach(s => {
                     try { s.stop(); } catch(e) {}
                 });
                 sourcesRef.current.clear();
                 nextStartTimeRef.current = 0;
                 setIsSpeaking(false);
            }
          },
          onclose: () => {
             isSessionActive.current = false;
             sessionRef.current = null;
          },
          onerror: (err) => {
            console.error("Session Error:", err);
            isSessionActive.current = false;
            disconnect('error');
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
            },
            systemInstruction: systemInstruction,
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error("Live session setup failed", e);
      await disconnect('error');
    }
  };

  // Updated disconnect to handle specific status states and prevent "closed" context errors
  const disconnect = async (nextStatus: 'idle' | 'error' | 'permission-denied' = 'idle') => {
     isSessionActive.current = false;
     
     // 1. Stop Media Stream
     if (streamRef.current) {
         streamRef.current.getTracks().forEach(t => t.stop());
         streamRef.current = null;
     }

     // 2. Safely Close Input Context
     if (inputAudioContextRef.current) {
         if (inputAudioContextRef.current.state !== 'closed') {
             try { await inputAudioContextRef.current.close(); } catch(e) { console.warn("Error closing input context", e); }
         }
         inputAudioContextRef.current = null;
     }

     // 3. Safely Close Output Context
     if (outputAudioContextRef.current) {
         if (outputAudioContextRef.current.state !== 'closed') {
             try { await outputAudioContextRef.current.close(); } catch(e) { console.warn("Error closing output context", e); }
         }
         outputAudioContextRef.current = null;
     }

     // 4. Close Gemini Session
     if (sessionRef.current) {
         const currentSession = sessionRef.current;
         sessionRef.current = null; // Clear ref immediately
         try {
             const session = await currentSession;
             await session.close();
         } catch (e) { 
             // Ignore errors if session is already closed/failed
         }
     }

     // 5. Reset State
     setStatus(nextStatus);
     setIsSpeaking(false);
     
     // Stop all active audio sources
     sourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
     sourcesRef.current.clear();
     nextStartTimeRef.current = 0;
  };

  if (!isOpen) return null;

  // Custom Styles for complex animations
  const styles = `
    @keyframes orbit-cw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes orbit-ccw { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
    @keyframes pulse-glow { 0% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } 100% { opacity: 0.4; transform: scale(1); } }
    @keyframes float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    @keyframes waveform { 0%, 100% { height: 10%; } 50% { height: 100%; } }
    .glass-panel {
        background: rgba(30, 31, 32, 0.75);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
  `;

  const Visualizer = ({ isActive, className }: { isActive: boolean, className?: string }) => (
      <div className={`flex items-center justify-center gap-1.5 h-8 ${className}`}>
          {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i} 
                className={`w-1.5 bg-white rounded-full transition-all duration-75 shadow-[0_0_10px_rgba(255,255,255,0.5)]`}
                style={{
                    height: isActive ? `${Math.random() * 24 + 6}px` : '4px',
                    opacity: isActive ? 1 : 0.3,
                }}
              />
          ))}
      </div>
  );

  // Minimized Floating View (Futuristic Orb)
  if (isMinimized) {
      return (
        <>
        <style>{styles}</style>
        <div 
            style={{ left: position.x, top: position.y }}
            className="fixed z-[60] cursor-move group transition-transform active:scale-95"
            onMouseDown={handleMouseDown}
        >
            <div className={`absolute inset-0 bg-primary/40 rounded-full blur-3xl transition-all duration-500 ${isSpeaking ? 'scale-150 opacity-80' : 'scale-100 opacity-30'}`}></div>
            <div className="relative w-24 h-24 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl ring-1 ring-white/10">
                 <div className="absolute inset-1 rounded-full border border-primary/30 border-t-transparent border-l-transparent animate-[orbit-cw_3s_linear_infinite]"></div>
                 <div className="absolute inset-2 rounded-full border border-white/10 border-b-transparent border-r-transparent animate-[orbit-ccw_4s_linear_infinite]"></div>
                 <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-primary via-blue-600 to-purple-600 flex items-center justify-center shadow-lg transition-all duration-300 ${isSpeaking ? 'scale-110 shadow-[0_0_20px_rgba(138,180,248,0.6)]' : 'scale-100 opacity-80'}`}>
                     {status === 'connecting' ? (
                         <div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin"></div>
                     ) : status === 'error' || status === 'permission-denied' ? (
                         <span className="text-red-500 font-bold">!</span>
                     ) : (
                        <Visualizer isActive={isSpeaking} className="h-4 gap-0.5" />
                     )}
                 </div>
                 <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2 backdrop-blur-sm">
                      <button onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }} className="p-2 text-white hover:text-primary transition-transform hover:scale-110">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2 text-white hover:text-red-400 transition-transform hover:scale-110">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                 </div>
            </div>
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border border-black/20 shadow-lg transition-colors ${status === 'connected' ? 'bg-green-500 text-black' : status === 'permission-denied' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'}`}>
                 {status === 'connected' ? 'Live' : status === 'permission-denied' ? 'No Mic' : 'Wait'}
            </div>
        </div>
        </>
      );
  }

  // Expanded View
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <style>{styles}</style>
      
      <div className="w-full max-w-3xl aspect-video max-h-[80vh] relative flex flex-col items-center justify-center glass-panel rounded-[40px] overflow-hidden">
        
        {/* Background Ambience */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
             <div className={`absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] transition-all duration-[2000ms] ${isSpeaking ? 'scale-125 opacity-40 translate-x-10' : 'scale-100 opacity-20'}`}></div>
             <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] transition-all duration-[2000ms] ${isSpeaking ? 'scale-125 opacity-40 -translate-x-10' : 'scale-100 opacity-20'}`}></div>
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
        </div>

        {/* Top Header UI */}
        <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-start z-10">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                </div>
                <div>
                    <h2 className="text-white font-google-sans text-xl font-medium tracking-tight">AI Tutor <span className="text-primary/80 mx-2">•</span> {subjectName}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : status === 'permission-denied' || status === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">
                            {status === 'connected' ? (isSpeaking ? 'Transmitting' : 'Listening') : status === 'permission-denied' ? 'Mic Access Denied' : status === 'error' ? 'Error' : 'Connecting...'}
                        </p>
                    </div>
                </div>
            </div>
            
            <div className="flex gap-3">
                <button onClick={() => setIsMinimized(true)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white flex items-center justify-center transition-all">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 14h-6v6M4 10h6V4M20 14l-7 7M4 10l7-7"/></svg>
                </button>
                <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-red-500/20 text-gray-300 hover:text-red-400 flex items-center justify-center transition-all">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
        </div>

        {/* CENTRAL HOLOGRAPHIC CORE */}
        <div className="relative z-0 flex items-center justify-center w-full h-full">
            {status === 'permission-denied' ? (
                 <div className="text-center max-w-md p-8 bg-red-500/10 border border-red-500/30 rounded-2xl backdrop-blur-md">
                     <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                     </div>
                     <h3 className="text-xl font-bold text-white mb-2">Microphone Blocked</h3>
                     <p className="text-gray-300">Please allow microphone access in your browser settings to talk with the AI tutor.</p>
                     <button onClick={() => { setStatus('idle'); startSession(); }} className="mt-4 px-6 py-2 bg-red-500/20 hover:bg-red-500/40 text-white rounded-full font-medium transition-colors">Retry Access</button>
                 </div>
            ) : status === 'error' ? (
                 <div className="text-center max-w-md p-8 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl backdrop-blur-md">
                     <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-400">
                         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                     </div>
                     <h3 className="text-xl font-bold text-white mb-2">Connection Failed</h3>
                     <p className="text-gray-300">Unable to connect to Gemini Live. Please check your network or try again later.</p>
                     <button onClick={() => { setStatus('idle'); startSession(); }} className="mt-4 px-6 py-2 bg-yellow-500/20 hover:bg-yellow-500/40 text-white rounded-full font-medium transition-colors">Retry Connection</button>
                 </div>
            ) : (
                /* Core Orb Animation */
                <div className="relative">
                    <div className={`absolute w-[400px] h-[400px] rounded-full border border-white/5 border-dashed animate-[orbit-cw_60s_linear_infinite] opacity-50 pointer-events-none`}></div>
                    <div className={`absolute w-[320px] h-[320px] rounded-full border border-primary/10 animate-[orbit-ccw_30s_linear_infinite] pointer-events-none`}></div>
                    
                    <div className={`absolute inset-0 bg-primary/30 rounded-full blur-[60px] transition-all duration-300 ${isSpeaking ? 'scale-150 opacity-100' : 'scale-100 opacity-40'}`}></div>
                    
                    <div className={`relative w-48 h-48 rounded-full overflow-hidden shadow-2xl ring-1 ring-white/20 flex items-center justify-center bg-black/20 backdrop-blur-md transition-transform duration-1000 ${isSpeaking ? 'scale-105' : 'scale-100 animate-[float-slow_6s_ease-in-out_infinite]'}`}>
                        <div className={`absolute inset-0 bg-gradient-to-br from-blue-600/80 via-primary/50 to-purple-600/80 opacity-80 mix-blend-screen transition-opacity duration-300 ${isSpeaking ? 'opacity-100' : 'opacity-60'}`}></div>
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                        
                        <div className="relative z-10 flex items-center justify-center">
                            {status === 'connecting' ? (
                                 <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                 <Visualizer isActive={isSpeaking} className="h-16 gap-2" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Bottom Control Bar */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
             <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 px-2 py-2 rounded-full shadow-2xl">
                 <button 
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${!isSpeaking ? 'bg-white/10 text-white' : 'text-gray-500'}`}
                 >
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                 </button>
                 <div className="h-8 w-[1px] bg-white/10"></div>
                 <button 
                    onClick={onClose}
                    className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-200 font-medium rounded-full transition-colors flex items-center gap-2"
                 >
                     <span className="w-2 h-2 bg-red-500 rounded-sm"></span> End Session
                 </button>
             </div>
        </div>

      </div>
    </div>
  );
};

export default LiveTutorModal;
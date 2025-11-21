import React, { useState, useEffect, useRef } from 'react';
import { Subject, Note, NoteType, FlowchartNode, QuizQuestion, Quiz } from './types';
import { generateSubjectFlowchart, generateQuiz, generateAudioOverview, searchWeb, generateFlashcards } from './services/geminiService';
import { decodeBase64ToUint8Array, decodeAudioData } from './services/audioUtils';
import { extractTextFromPPTX } from './services/pptUtils';
import Flowchart from './components/Flowchart';
import LiveTutorModal from './components/LiveTutorModal';
import QuizModal from './components/QuizModal';
import FlashcardReview from './components/FlashcardReview';
import FileViewer from './components/FileViewer';
import { Auth } from './components/Auth';
import { supabase } from './services/supabase';
import { getUserSubjects, createSubjectInDb, deleteSubjectInDb, addNoteToDb, deleteNoteInDb, updateSubjectArtifacts } from './services/dataService';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/utils';

// UI Icons
const Icons = {
  Plus: () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m7-7H5"/></svg>,
  Mic: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>,
  Play: () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>,
  Pause: () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>,
  File: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
  Spark: () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>,
  Trash: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Menu: () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>,
  X: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  Search: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  ChevronLeft: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>,
  ChevronRight: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>,
  Help: () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  Network: () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="6" height="6"></rect><rect x="16" y="16" width="6" height="6"></rect><rect x="2" y="16" width="6" height="6"></rect><rect x="16" y="2" width="6" height="6"></rect><line x1="12" y1="6" x2="16" y2="6"></line><line x1="8" y1="6" x2="12" y2="6"></line><line x1="12" y1="18" x2="16" y2="18"></line><line x1="8" y1="18" x2="12" y2="18"></line><line x1="12" y1="6" x2="12" y2="18"></line></svg>,
  Home: () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Clock: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  CloudUpload: () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Download: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Book: () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showLiveTutor, setShowLiveTutor] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  
  // Layout state
  const [isSourcesOpen, setIsSourcesOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'graph' | 'audio' | 'quiz' | 'flashcards' | 'reader'>('graph');
  
  // Viewer State
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [viewState, setViewState] = useState<any>(null); // e.g., { slide: 1 }

  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Quiz Config
  const [quizQuestionCount, setQuizQuestionCount] = useState(5);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    }).catch((err) => {
        console.warn("Failed to retrieve session (Likely missing Supabase config):", err);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load data when session exists
  useEffect(() => {
      if (session) {
          loadData();
      }
  }, [session]);

  const loadData = async () => {
      setIsLoading(true);
      try {
          const data = await getUserSubjects();
          setSubjects(data);
      } catch (e) {
          console.error("Failed to load data", e);
      } finally {
          setIsLoading(false);
      }
  };

  const handleCreateNotebook = async () => {
    if (!newNotebookName.trim()) return;
    
    const newSubject: Subject = {
      id: generateId(),
      name: newNotebookName.trim(),
      notes: [],
      flowchart: null,
      quizzes: [],
      flashcards: [],
      studyTime: 0,
      lastActive: Date.now()
    };

    // Optimistic Update
    setSubjects(prev => [newSubject, ...prev]);
    setActiveSubjectId(newSubject.id);
    setIsCreating(false);
    setNewNotebookName("");

    // DB Sync only if logged in
    if (session) {
        try {
            await createSubjectInDb(newSubject);
        } catch (e) {
            console.error(e);
            alert("Failed to save notebook to cloud");
        }
    }
  };

  const deleteSubject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this notebook permanently?")) {
        setSubjects(prev => prev.filter(s => s.id !== id));
        if (activeSubjectId === id) setActiveSubjectId(null);
        
        if (session) {
            await deleteSubjectInDb(id);
        }
    }
  }

  const activeSubject = subjects.find(s => s.id === activeSubjectId);
  const activeNote = activeSubject?.notes.find(n => n.id === activeNoteId);

  const addNote = async (content: string, type: NoteType = NoteType.TEXT, fileName?: string, structuredData?: any) => {
    if (!activeSubjectId) return;
    const newNote: Note = {
      id: generateId(),
      type,
      content,
      fileName,
      timestamp: Date.now(),
      structuredData
    };
    
    // Optimistic
    const updatedSubjects = subjects.map(s => s.id === activeSubjectId ? { ...s, notes: [...s.notes, newNote] } : s);
    setSubjects(updatedSubjects);

    // Sync only if logged in
    if (session) {
        try {
            await addNoteToDb(activeSubjectId, newNote);
        } catch (e) {
            console.error(e);
            alert("Failed to save note to cloud");
        }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const result = await searchWeb(searchQuery);
      await addNote(result, NoteType.TEXT, `Web: ${searchQuery}`);
      setSearchQuery("");
    } catch (e) {
      alert("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const processFile = async (file: File) => {
      try {
        // Handle PPTX
        if (file.name.toLowerCase().endsWith('.pptx')) {
            try {
                const { fullText, slides } = await extractTextFromPPTX(file);
                await addNote(fullText, NoteType.TEXT, file.name, slides);
            } catch (err) {
                console.error(err);
                alert(`Failed to parse PPTX: ${file.name}`);
            }
        } 
        // Handle PDF
        else if (file.type.includes('pdf')) {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                await addNote(base64, NoteType.PDF, file.name);
            };
            reader.readAsDataURL(file);
        } 
        // Handle Images
        else if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                await addNote(base64, NoteType.IMAGE, file.name);
            };
            reader.readAsDataURL(file);
        } 
        // Handle Text
        else if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
             const text = await file.text();
             await addNote(text, NoteType.TEXT, file.name);
        } 
        else {
            alert(`Unsupported file type: ${file.name}`);
        }
    } catch (err) {
        console.error("File upload error", err);
        alert("Error processing file");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeSubjectId) return;
    Array.from(files).forEach(processFile);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files: File[] = Array.from(e.dataTransfer.files);
    if (files.length === 0 || !activeSubjectId) return;
    files.forEach(processFile);
  };

  const deleteNote = async (noteId: string) => {
    if(!activeSubjectId) return;
    const updatedSubjects = subjects.map(s => s.id === activeSubjectId ? { ...s, notes: s.notes.filter(n => n.id !== noteId) } : s);
    setSubjects(updatedSubjects);
    if(activeNoteId === noteId) setActiveNoteId(null);
    
    if (session) {
        await deleteNoteInDb(noteId);
    }
  };

  const openNote = (note: Note) => {
      setActiveNoteId(note.id);
      setActiveTab('reader');
  }

  // --- AI Generations ---

  const handleGenerateMap = async () => {
    if (!activeSubject || activeSubject.notes.length === 0) {
        alert("Please add some notes first!");
        return;
    }
    setIsLoading(true);
    try {
      const data = await generateSubjectFlowchart(activeSubject.notes);
      setSubjects(subjects.map(s => s.id === activeSubject.id ? { ...s, flowchart: data } : s));
      
      if (session) {
          await updateSubjectArtifacts(activeSubject.id, { flowchart: data });
      }
    } catch (e) { 
      console.error(e);
      alert("Failed to generate study guide."); 
    } 
    finally { setIsLoading(false); }
  };

  const handleGenerateAudio = async (): Promise<string | null> => {
     const subject = subjects.find(s => s.id === activeSubjectId);
     if (!subject || subject.notes.length === 0) return null;
     
     setIsLoading(true);
     try {
       const audioData = await generateAudioOverview(subject.notes);
       const newAudioOverview = { audioData, transcript: '' };
       setSubjects(prev => prev.map(s => s.id === subject.id ? { ...s, audioOverview: newAudioOverview } : s));
       
       if (session) {
           await updateSubjectArtifacts(subject.id, { audioOverview: newAudioOverview });
       }
       return audioData;
     } catch(e) { 
         console.error(e);
         alert("Failed to create audio overview.");
         return null;
     } 
     finally { setIsLoading(false); }
  };

  const handleGenerateQuiz = async () => {
     if (!activeSubject || activeSubject.notes.length === 0) return;
     setIsLoading(true);
     try {
         const questions = await generateQuiz(activeSubject.notes, quizQuestionCount);
         const newQuiz: Quiz = {
             id: generateId(),
             createdAt: Date.now(),
             title: `Quiz ${activeSubject.quizzes.length + 1}`,
             questions: questions
         };
         const updatedQuizzes = [newQuiz, ...(activeSubject.quizzes || [])];
         setSubjects(subjects.map(s => s.id === activeSubject.id ? { ...s, quizzes: updatedQuizzes } : s));
         
         if (session) {
             await updateSubjectArtifacts(activeSubject.id, { quizzes: updatedQuizzes });
         }
     } catch(e) { alert("Quiz gen failed."); } 
     finally { setIsLoading(false); }
  };

  const handleGenerateFlashcards = async () => {
      if (!activeSubject || activeSubject.notes.length === 0) return;
      setIsLoading(true);
      try {
          const cards = await generateFlashcards(activeSubject.notes);
          setSubjects(subjects.map(s => s.id === activeSubject.id ? { ...s, flashcards: cards } : s));
          
          if (session) {
              await updateSubjectArtifacts(activeSubject.id, { flashcards: cards });
          }
      } catch (e) {
          console.error(e);
          alert("Failed to generate flashcards");
      } finally {
          setIsLoading(false);
      }
  };

  const toggleAudio = async () => {
    let currentSubject = subjects.find(s => s.id === activeSubjectId);
    let audioData = currentSubject?.audioOverview?.audioData;

    if (!audioData) {
        const generated = await handleGenerateAudio();
        if (!generated) return;
        audioData = generated;
    }

    if (isAudioPlaying) {
        audioSourceRef.current?.stop();
        setIsAudioPlaying(false);
        return;
    }

    if (!audioContextRef.current) {
       audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    }
    const ctx = audioContextRef.current;
    
    if (ctx.state === 'suspended') await ctx.resume();

    try {
        const raw = decodeBase64ToUint8Array(audioData!);
        const buffer = await decodeAudioData(raw, ctx);
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => setIsAudioPlaying(false);
        source.start();
        audioSourceRef.current = source;
        setIsAudioPlaying(true);
    } catch (e) {
        console.error("Audio playback error", e);
        alert("Failed to play audio.");
    }
  };

  const toggleNode = async (nodeId: string) => {
      if (!activeSubject?.flowchart) return;
      const updatedNodes = activeSubject.flowchart.nodes.map(n => 
          n.id === nodeId ? { ...n, completed: !n.completed } : n
      );
      const updatedFlowchart = { ...activeSubject.flowchart, nodes: updatedNodes };
      setSubjects(subjects.map(s => s.id === activeSubject.id ? { ...s, flowchart: updatedFlowchart } : s));
      
      if (session) {
          await updateSubjectArtifacts(activeSubject.id, { flowchart: updatedFlowchart });
      }
  };

  if (!session && !isGuest) {
      return <Auth onLogin={() => setIsGuest(true)} />;
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden selection:bg-primary/30">
      
      {/* Sidebar - Icon Only Rail */}
      <div className="w-20 bg-muted/40 border-r flex flex-col items-center py-6 z-50 flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 mb-8">
              <Icons.Spark />
          </div>
          
          <div className="flex-1 w-full flex flex-col items-center gap-4">
              <Button 
                onClick={() => setActiveSubjectId(null)} 
                variant={!activeSubjectId ? 'secondary' : 'ghost'}
                size="icon"
                className="group relative"
              >
                  <Icons.Home />
                  <span className="absolute left-full ml-4 bg-popover border px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">Dashboard</span>
              </Button>

              <Button 
                onClick={() => setIsCreating(true)} 
                variant="ghost"
                size="icon"
                className="group relative"
              >
                  <Icons.Plus />
                  <span className="absolute left-full ml-4 bg-popover border px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">New Notebook</span>
              </Button>

              <div className="w-8 h-[1px] bg-border my-2"></div>

              <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-3 px-2 custom-scrollbar">
                   {subjects.map(sub => (
                       <Button 
                            key={sub.id} 
                            onClick={() => { setActiveSubjectId(sub.id); setActiveNoteId(null); setActiveTab('graph'); }}
                            variant={activeSubjectId === sub.id ? 'default' : 'ghost'}
                            className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-all text-xs font-bold border-2 group relative",
                                activeSubjectId === sub.id ? 'border-primary text-primary bg-primary/10' : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
                            )}
                       >
                           {sub.name.substring(0, 2).toUpperCase()}
                           <span className="absolute left-full ml-4 bg-popover border px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">{sub.name}</span>
                       </Button>
                   ))}
              </div>
              
              <Button variant="ghost" onClick={() => { 
                  if (session) supabase.auth.signOut(); 
                  setIsGuest(false);
                  setSubjects([]);
              }} className="mb-4">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </Button>
          </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
         {activeSubjectId ? (
            <div className="flex-1 flex overflow-hidden h-full relative">
                {/* Sources Panel */}
                <div className={cn("transition-all duration-300 border-r bg-muted/20 flex flex-col relative z-20 flex-shrink-0", isSourcesOpen ? 'w-[320px]' : 'w-0 opacity-0 pointer-events-none')}>
                     <div className="p-5 border-b flex justify-between items-center">
                         <h3 className="font-medium text-lg">Sources</h3>
                         <div className="flex gap-1">
                             <Button variant="ghost" size="icon" onClick={() => document.getElementById('fileUpload')?.click()}><Icons.Plus /></Button>
                             <input type="file" id="fileUpload" className="hidden" onChange={handleFileUpload} accept=".pdf,image/*,.txt,.pptx" multiple />
                             <Button variant="ghost" size="icon" onClick={() => setIsSourcesOpen(false)}><Icons.ChevronLeft /></Button>
                         </div>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                         <div 
                            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => document.getElementById('fileUpload')?.click()} 
                            className={cn("border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer mb-6", isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground')}
                         >
                             <div className="mb-3 text-muted-foreground"><Icons.CloudUpload /></div>
                             <p className="text-sm text-muted-foreground font-medium">Upload PDF, PPTX, Images</p>
                         </div>

                         <div className="relative mb-4">
                             <input type="text" placeholder="Search web..." className="w-full bg-background border rounded-xl pl-10 pr-4 py-3 text-sm focus:border-primary focus:outline-none transition-colors" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                             <div className="absolute left-3 top-3 text-muted-foreground">{isSearching ? <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div> : <Icons.Search />}</div>
                         </div>

                         {activeSubject?.notes.map(note => (
                             <div 
                                key={note.id} 
                                onClick={() => openNote(note)}
                                className={cn("border rounded-xl p-4 group transition-all cursor-pointer", activeNoteId === note.id ? 'bg-primary/10 border-primary' : 'bg-card hover:border-muted-foreground')}
                             >
                                 <div className="flex justify-between items-start mb-2">
                                     <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", activeNoteId === note.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{note.type}</span>
                                     <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="text-muted-foreground hover:text-destructive h-6 w-6 opacity-0 group-hover:opacity-100"><Icons.Trash /></Button>
                                 </div>
                                 <p className="text-sm line-clamp-2 font-medium">{note.fileName || note.content.substring(0, 50)}</p>
                             </div>
                         ))}
                     </div>
                </div>

                {!isSourcesOpen && <Button variant="outline" size="icon" onClick={() => setIsSourcesOpen(true)} className="absolute left-4 top-4 z-30 shadow-xl"><Icons.Menu /></Button>}

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col h-full min-w-0 bg-background relative z-10">
                    {/* Top Bar */}
                    <div className="h-16 border-b flex items-center justify-between px-6 bg-background/80 backdrop-blur-md z-20">
                        <div className="flex items-center gap-4 overflow-hidden">
                            {!isSourcesOpen && <div className="w-8"></div>}
                            <h2 className="text-xl font-bold truncate max-w-[300px]">{activeSubject?.name}</h2>
                            {activeNoteId && (
                                <div className="hidden sm:flex px-3 py-1 bg-muted text-muted-foreground text-xs font-bold rounded-full items-center gap-2 border">
                                    Viewing File
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {/* Tabs - Only show if NOT viewing a file for cleaner UI */}
                            {!activeNoteId && (
                                <div className="hidden md:flex bg-muted rounded-lg p-1 mr-4">
                                    {['graph', 'flashcards', 'quiz', 'audio'].map((tab) => (
                                        <Button key={tab} variant={activeTab === tab ? 'secondary' : 'ghost'} onClick={() => setActiveTab(tab as any)} className="px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all">{tab}</Button>
                                    ))}
                                </div>
                            )}

                            <Button onClick={() => setShowLiveTutor(true)} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all transform hover:scale-105 active:scale-95">
                                <Icons.Mic /> <span>Live Tutor</span>
                            </Button>
                        </div>
                    </div>

                    {/* Main Viewport */}
                    <div className="flex-1 overflow-hidden relative bg-background">
                        {activeNoteId && activeNote ? (
                            <FileViewer 
                                note={activeNote} 
                                onClose={() => { setActiveNoteId(null); setActiveTab('graph'); }} 
                                onPageChange={(page) => setViewState({ slide: page })}
                            />
                        ) : (
                            <div className="h-full w-full overflow-y-auto bg-dot-pattern">
                                <div className="absolute inset-0 bg-gradient-to-b from-background to-transparent pointer-events-none h-24"></div>
                                {activeTab === 'graph' && (
                                    <div className="h-full flex flex-col animate-fade-in p-6 pt-0">
                                        <div className="flex justify-between items-center mb-4 mt-6">
                                            <h3 className="text-xl font-medium">Concept Map</h3>
                                            {!activeSubject?.flowchart && <Button onClick={handleGenerateMap} disabled={isLoading}>Generate Graph</Button>}
                                        </div>
                                        <div className="flex-1 relative bg-card/50 rounded-3xl border overflow-hidden shadow-inner backdrop-blur-sm">
                                            {activeSubject?.flowchart ? <Flowchart nodes={activeSubject.flowchart.nodes} edges={activeSubject.flowchart.edges} onToggleNode={toggleNode} /> : <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground"><div className="p-6 bg-muted rounded-full mb-4"><Icons.Network /></div><p>Visualize your notes as a dependency graph.</p></div>}
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'audio' && (
                                    <div className="h-full flex items-center justify-center animate-fade-in">
                                        <div className="bg-card rounded-3xl p-12 border flex flex-col items-center text-center shadow-2xl max-w-md relative overflow-hidden">
                                             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-purple-500"></div>
                                             <Button onClick={toggleAudio} disabled={isLoading} size="lg" className={cn("w-24 h-24 rounded-full flex items-center justify-center mb-8 transition-all shadow-xl", isAudioPlaying ? 'bg-primary text-primary-foreground scale-110' : 'bg-secondary text-secondary-foreground hover:scale-105')}>
                                                 {isLoading ? <div className="w-8 h-8 border-4 border-foreground border-t-transparent rounded-full animate-spin"></div> : (isAudioPlaying ? <Icons.Pause /> : <Icons.Play />)}
                                             </Button>
                                             <h3 className="text-2xl font-medium mb-2">Audio Overview</h3>
                                             <p className="text-muted-foreground mb-8 leading-relaxed">{activeSubject?.audioOverview ? "Listen to your AI generated podcast overview of this notebook." : "Generate a conversation about your notes to listen on the go."}</p>
                                             {activeSubject?.audioOverview?.audioData && (
                                                <a 
                                                    href={`data:audio/wav;base64,${activeSubject.audioOverview.audioData}`} 
                                                    download={`${activeSubject.name}-overview.wav`}
                                                    className="flex items-center gap-2 text-sm text-primary hover:text-white transition-colors font-medium"
                                                >
                                                    <Icons.Download /> Download Audio
                                                </a>
                                             )}
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'quiz' && (
                                    <div className="max-w-5xl mx-auto pt-10 px-6 animate-fade-in">
                                        <div className="flex justify-between items-center mb-8">
                                            <h3 className="text-2xl font-medium">Practice Quizzes</h3>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 bg-muted border rounded-lg px-3 py-1.5">
                                                    <span className="text-xs text-muted-foreground font-bold uppercase">Questions</span>
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        max="20" 
                                                        value={quizQuestionCount} 
                                                        onChange={(e) => setQuizQuestionCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                                                        className="w-12 bg-transparent font-bold text-center focus:outline-none text-sm"
                                                    />
                                                </div>
                                                <Button onClick={handleGenerateQuiz} disabled={isLoading}>
                                                    {isLoading ? <div className="w-4 h-4 border-2 border-foreground rounded-full animate-spin" /> : <Icons.Spark />} Generate New
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {activeSubject?.quizzes.map(q => (
                                                <div key={q.id} onClick={() => { setActiveQuiz(q); setShowQuiz(true); }} className="bg-card border p-6 rounded-2xl hover:border-primary cursor-pointer transition-all hover:-translate-y-1 shadow-lg group">
                                                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-black transition-colors"><Icons.Help /></div>
                                                    <h4 className="font-bold text-lg mb-1">{q.title}</h4>
                                                    <p className="text-muted-foreground text-sm">{q.questions.length} Questions • {new Date(q.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'flashcards' && (
                                    <FlashcardReview flashcards={activeSubject.flashcards} onGenerate={handleGenerateFlashcards} isLoading={isLoading} />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
         ) : (
             // Dashboard Empty State
             <div className="flex-1 overflow-y-auto p-8 bg-background">
                <div className="max-w-6xl mx-auto pt-12">
                    <h1 className="text-5xl font-bold mb-4 tracking-tight">Welcome to NeuroNote</h1>
                    <p className="text-muted-foreground text-xl mb-16 max-w-2xl leading-relaxed">An interactive AI study companion that transforms your materials into deep understanding.</p>
                    
                    {isLoading && subjects.length === 0 ? (
                       <div className="flex justify-center py-20">
                           <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                       </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* Create New Card */}
                            <Button onClick={() => setIsCreating(true)} className="group relative h-72 rounded-[32px] overflow-hidden transition-all duration-500 hover:-translate-y-2">
                                <div className="absolute inset-0 bg-muted/40 border transition-all group-hover:border-primary/50"></div>
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                    <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mb-6 border shadow-xl group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 transition-all duration-300">
                                        <Icons.Plus />
                                    </div>
                                    <h3 className="text-2xl font-medium mb-2">New Notebook</h3>
                                    <p className="text-muted-foreground">Start a new subject</p>
                                </div>
                            </Button>
                            
                            {subjects.map(subject => (
                                <div key={subject.id} onClick={() => setActiveSubjectId(subject.id)} className="group relative h-72 bg-card rounded-[32px] border p-8 flex flex-col justify-between cursor-pointer hover:border-primary/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                                    <div className="flex justify-between items-start">
                                        <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center font-bold text-xl shadow-inner border">
                                            {subject.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={(e) => deleteSubject(e, subject.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                                            <Icons.Trash />
                                        </Button>
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-bold mb-2 truncate">{subject.name}</h3>
                                        <div className="flex gap-3 text-sm text-muted-foreground">
                                            <span className="bg-muted px-3 py-1 rounded-full border">{subject.notes.length} sources</span>
                                            <span className="bg-muted px-3 py-1 rounded-full border">{subject.quizzes.length} quizzes</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-4">Last active: {new Date(subject.lastActive).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* 3D Creation Modal */}
                {isCreating && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                        <div className="w-full max-w-md bg-card rounded-[32px] p-1 shadow-2xl relative transform transition-all scale-100 ring-1 ring-white/10">
                             {/* Gradient Border Effect */}
                             <div className="absolute inset-0 rounded-[32px] bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                             
                             <div className="bg-card rounded-[28px] p-8 relative overflow-hidden">
                                 <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/20 blur-[60px] rounded-full pointer-events-none"></div>
                                 
                                 <h3 className="text-2xl font-bold mb-2 relative z-10">Create Notebook</h3>
                                 <p className="text-muted-foreground mb-8 relative z-10">What subject would you like to study today?</p>
                                 
                                 <div className="space-y-4 relative z-10">
                                     <div>
                                         <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1 mb-1 block">Notebook Name</label>
                                         <input 
                                            autoFocus 
                                            type="text" 
                                            placeholder="e.g., Advanced Biology" 
                                            className="w-full bg-background border rounded-2xl px-6 py-4 text-lg focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all shadow-inner" 
                                            value={newNotebookName} 
                                            onChange={(e) => setNewNotebookName(e.target.value)} 
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateNotebook()} 
                                        />
                                     </div>
                                     
                                     <div className="flex justify-end gap-3 pt-4">
                                         <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                                         <Button 
                                            onClick={handleCreateNotebook} 
                                            className="font-bold text-lg"
                                         >
                                             Create
                                         </Button>
                                     </div>
                                 </div>
                             </div>
                        </div>
                    </div>
                )}
             </div>
         )}
      </div>

      {activeSubject && (
          <>
              <LiveTutorModal 
                isOpen={showLiveTutor} 
                onClose={() => setShowLiveTutor(false)} 
                notes={activeSubject.notes} 
                subjectName={activeSubject.name} 
                activeNote={activeNote}
                viewState={viewState}
              />
              <QuizModal isOpen={showQuiz} onClose={() => setShowQuiz(false)} questions={activeQuiz ? activeQuiz.questions : []} />
          </>
      )}
    </div>
  );
}
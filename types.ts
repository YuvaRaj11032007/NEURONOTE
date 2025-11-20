
export enum NoteType {
  TEXT = 'TEXT',
  PDF = 'PDF',
  IMAGE = 'IMAGE'
}

export interface Note {
  id: string;
  type: NoteType;
  content: string; // Text content or Base64 string for files
  fileName?: string;
  timestamp: number;
  structuredData?: any; // For PPTX slides or other parsed structures
}

export interface FlowchartNode {
  id: string;
  label: string;
  completed: boolean;
  description?: string;
}

export interface FlowchartEdge {
  source: string;
  target: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  createdAt: number;
  title: string;
  questions: QuizQuestion[];
  score?: number;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  status?: 'learning' | 'mastered';
}

export interface Subject {
  id: string;
  name: string;
  notes: Note[];
  flowchart: {
    nodes: FlowchartNode[];
    edges: FlowchartEdge[];
  } | null;
  quizzes: Quiz[]; 
  flashcards: Flashcard[]; 
  audioOverview?: {
    audioData: string; // Base64 audio
    transcript?: string;
  };
  studyTime: number; // seconds
  lastActive: number;
}

export interface PcmAudioBlob {
  data: string; // Base64
  mimeType: string;
}

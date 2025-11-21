
import { supabase } from './supabase';
import { Subject, Note, NoteType } from '../types';
import { encodeUint8ArrayToBase64, decodeBase64ToUint8Array } from './audioUtils';

// --- Types mapping to DB ---
// We keep strictly structured data (Subjects, Notes) in tables.
// Complex nested JSON (Quizzes, Flashcards, Flowchart) is stored in JSONB columns on the Subject table for simplicity.

export const getUserSubjects = async (): Promise<Subject[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // 1. Get Subjects
    const { data: subjectsData, error: subError } = await supabase
        .from('subjects')
        .select('*')
        .order('last_active', { ascending: false });

    if (subError) {
        console.error("Error fetching subjects:", subError);
        return [];
    }

    if (!subjectsData) return [];

    // 2. Get Notes for all subjects
    // We fetch all notes for the user to construct the tree. 
    // For a production app with thousands of notes, you'd fetch notes on demand.
    const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*');

    if (notesError) console.error("Error fetching notes:", notesError);

    // 3. Reconstruct the object graph
    const subjects: Subject[] = await Promise.all(subjectsData.map(async (s: any) => {
        const subjectNotes = notesData ? notesData.filter((n: any) => n.subject_id === s.id) : [];
        
        // Hydrate notes content (download from storage if it's a file)
        const hydratedNotes = await Promise.all(subjectNotes.map(async (n: any) => {
            let content = n.content;
            
            // If it's a file path, we need to download it or get the signed url
            // To maintain compatibility with the existing app which expects base64 content for AI processing,
            // we download the file blob and convert to base64.
            if (n.file_path) {
                try {
                    const { data: blob } = await supabase.storage.from('assets').download(n.file_path);
                    if (blob) {
                        const buffer = await blob.arrayBuffer();
                        content = encodeUint8ArrayToBase64(new Uint8Array(buffer));
                    }
                } catch (e) {
                    console.error(`Failed to download note asset ${n.file_path}`, e);
                }
            }

            return {
                id: n.id,
                type: n.type as NoteType,
                content: content || '',
                fileName: n.file_name,
                timestamp: n.timestamp,
                structuredData: n.structured_data
            };
        }));

        return {
            id: s.id,
            name: s.name,
            notes: hydratedNotes,
            flowchart: s.flowchart,
            quizzes: s.quizzes || [],
            flashcards: s.flashcards || [],
            audioOverview: s.audio_overview ? {
                // If we stored audio path in jsonb, we might need to hydrate it too. 
                // For simplicity in this version, assuming audioOverview stores base64 or we re-generate it.
                // Storing 5MB+ base64 in JSONB is bad, but let's check if it has an 'audioPath' property we added.
                audioData: s.audio_overview.audioData, 
                transcript: s.audio_overview.transcript
            } : undefined,
            studyTime: s.study_time || 0,
            lastActive: s.last_active || Date.now()
        };
    }));

    return subjects;
};

export const createSubjectInDb = async (subject: Subject) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from('subjects').insert({
        id: subject.id,
        user_id: user.id,
        name: subject.name,
        last_active: subject.lastActive,
        study_time: subject.studyTime,
        flowchart: null,
        quizzes: [],
        flashcards: []
    });

    if (error) throw error;
};

export const deleteSubjectInDb = async (subjectId: string) => {
    // Cascade delete in DB handles notes, but we should cleanup storage.
    // Fetch notes first to get file paths
    const { data: notes } = await supabase.from('notes').select('file_path').eq('subject_id', subjectId);
    
    if (notes && notes.length > 0) {
        const paths = notes.map((n: any) => n.file_path).filter(Boolean);
        if (paths.length > 0) {
             await supabase.storage.from('assets').remove(paths);
        }
    }

    const { error } = await supabase.from('subjects').delete().eq('id', subjectId);
    if (error) throw error;
};

export const addNoteToDb = async (subjectId: string, note: Note) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    let contentToStore = note.content;
    let filePath = null;

    // Upload heavy files to Storage
    if (note.type === NoteType.PDF || note.type === NoteType.IMAGE) {
        try {
            const buffer = decodeBase64ToUint8Array(note.content);
            const path = `${user.id}/${subjectId}/${note.id}.${note.type === NoteType.PDF ? 'pdf' : 'bin'}`;
            
            const { error: uploadError } = await supabase.storage
                .from('assets')
                .upload(path, buffer, {
                    contentType: note.type === NoteType.PDF ? 'application/pdf' : 'image/png',
                    upsert: true
                });

            if (uploadError) throw uploadError;
            
            filePath = path;
            contentToStore = ''; // Clear base64 from DB row
        } catch (e) {
            console.error("Upload failed, falling back to DB storage (not recommended)", e);
            // If upload fails, we might fallback or throw.
        }
    }

    const { error } = await supabase.from('notes').insert({
        id: note.id,
        subject_id: subjectId,
        user_id: user.id,
        type: note.type,
        content: contentToStore, // Text stays here, files go empty
        file_path: filePath,
        file_name: note.fileName,
        timestamp: note.timestamp,
        structured_data: note.structuredData
    });

    if (error) throw error;
};

export const deleteNoteInDb = async (noteId: string) => {
    // Check for file path to delete
    const { data } = await supabase.from('notes').select('file_path').eq('id', noteId).single();
    if (data?.file_path) {
        await supabase.storage.from('assets').remove([data.file_path]);
    }
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error) throw error;
};

// Updates the metadata columns (JSONB) for a subject
export const updateSubjectArtifacts = async (subjectId: string, updates: Partial<any>) => {
    // Remap camelCase to snake_case for DB columns
    const dbUpdates: any = { last_active: Date.now() };
    if (updates.flowchart !== undefined) dbUpdates.flowchart = updates.flowchart;
    if (updates.quizzes !== undefined) dbUpdates.quizzes = updates.quizzes;
    if (updates.flashcards !== undefined) dbUpdates.flashcards = updates.flashcards;
    if (updates.audioOverview !== undefined) dbUpdates.audio_overview = updates.audioOverview;

    const { error } = await supabase.from('subjects').update(dbUpdates).eq('id', subjectId);
    if (error) throw error;
};

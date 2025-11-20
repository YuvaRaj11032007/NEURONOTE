
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Note, FlowchartNode, FlowchartEdge, QuizQuestion, NoteType, Flashcard } from "../types";

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to prepare contents from notes
export const prepareContents = (notes: Note[], prompt: string) => {
  const parts: any[] = [{ text: prompt }];
  
  notes.forEach(note => {
    if (note.type === NoteType.TEXT) {
      parts.push({ text: `Note content (${note.fileName || 'Text'}): ${note.content}` });
    } else if (note.type === NoteType.PDF) {
        parts.push({ inlineData: { mimeType: 'application/pdf', data: note.content } });
    } else if (note.type === NoteType.IMAGE) {
        // Improved MIME type detection based on filename extension
        let mimeType = 'image/jpeg'; // default
        if (note.fileName) {
            const ext = note.fileName.split('.').pop()?.toLowerCase();
            if (ext === 'png') mimeType = 'image/png';
            else if (ext === 'webp') mimeType = 'image/webp';
            else if (ext === 'heic') mimeType = 'image/heic';
            else if (ext === 'heif') mimeType = 'image/heif';
        } else {
            // Fallback magic number check for PNG
            if (note.content.startsWith('iVBORw0KGgo')) mimeType = 'image/png';
        }
        parts.push({ inlineData: { mimeType, data: note.content } });
    }
  });
  return parts;
};

export const searchWeb = async (query: string): Promise<string> => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [{ text: `Search for information about: "${query}". Provide a comprehensive summary suitable for study notes.` }] },
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  
  let text = response.text || '';
  
  // Extract sources if available to append to the note
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
      const links = chunks
        .map((c: any) => c.web?.uri ? `[${c.web.title || 'Source'}](${c.web.uri})` : null)
        .filter(Boolean)
        .join('  ');
      if (links) text += `\n\nSources: ${links}`;
  }
  
  return text;
};

export const generateSubjectFlowchart = async (notes: Note[]): Promise<{ nodes: FlowchartNode[], edges: FlowchartEdge[] }> => {
  const ai = getAiClient();
  const prompt = `
    Analyze the provided study notes. 
    Construct a concise concept map (flowchart) for this subject.
    Limit the graph to the top 8-15 most important concepts to ensure clarity.
    Return a strictly valid JSON object with 'nodes' (id, label, description) and 'edges' (source, target).
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: prepareContents(notes, prompt) },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                description: { type: Type.STRING },
                completed: { type: Type.BOOLEAN }
              },
              required: ["id", "label", "description"]
            }
          },
          edges: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                target: { type: Type.STRING }
              },
              required: ["source", "target"]
            }
          }
        },
        required: ["nodes", "edges"]
      }
    }
  });

  if (response.text) {
      try {
        const cleanText = response.text.replace(/```json\n?|\n?```/g, '').trim();
        const data = JSON.parse(cleanText);
        return data;
      } catch (e) {
        console.error("JSON Parse Error:", e);
        throw new Error("Failed to parse flowchart data.");
      }
  }
  throw new Error("Failed to generate flowchart");
};

export const generateQuiz = async (notes: Note[], numQuestions: number = 5): Promise<QuizQuestion[]> => {
  const ai = getAiClient();
  const prompt = `Create ${numQuestions} multiple choice questions based on these notes to test understanding.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: prepareContents(notes, prompt) },
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswerIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                }
            }
        }
    }
  });

  if (response.text) {
    const cleanText = response.text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanText);
  }
  throw new Error("Failed to generate quiz");
};

export const generateFlashcards = async (notes: Note[]): Promise<Flashcard[]> => {
  const ai = getAiClient();
  const prompt = `
    Create a set of 10 high-quality flashcards based on the study notes.
    Each flashcard should have a 'front' (Term, Concept, or Question) and a 'back' (Definition, Explanation, or Answer).
    Keep content concise for flashcard format.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: prepareContents(notes, prompt) },
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    front: { type: Type.STRING },
                    back: { type: Type.STRING }
                },
                required: ["id", "front", "back"]
            }
        }
    }
  });

  if (response.text) {
    const cleanText = response.text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanText);
  }
  throw new Error("Failed to generate flashcards");
};

export const generateAudioOverview = async (notes: Note[]): Promise<string> => {
  const ai = getAiClient();

  try {
      // Step 1: Generate the script
      const scriptPrompt = `
        Generate a podcast script discussing these notes. 
        The format MUST be strictly:
        Joe: [Line]
        Jane: [Line]
        
        Rules:
        1. Keep it under 400 words.
        2. ABSOLUTELY NO markdown (no bold **, no italics *).
        3. NO stage directions or actions in brackets (e.g. NO [laughs], NO [sighs]).
        4. Just simple spoken words.
      `;

      const scriptResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: prepareContents(notes, scriptPrompt) },
      });

      let script = scriptResponse.text || '';
      if (!script) throw new Error("Failed to generate audio script");

      // Heavy sanitization to ensure TTS compatibility
      script = script
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/\[.*?\]/g, '') 
        .replace(/\(.*?\)/g, '')
        .replace(/^\s*[\r\n]/gm, '');

      // Step 2: Generate Audio
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: script }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                    { speaker: 'Joe', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                    { speaker: 'Jane', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
                ]
            }
          }
        }
      });

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) return base64Audio;
      throw new Error("No audio data received");
      
  } catch (e) {
      console.error("Audio Generation Error", e);
      throw e;
  }
};

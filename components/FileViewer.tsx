
import React, { useState, useEffect, useRef } from 'react';
import { Note, NoteType } from '../types';
import { decodeBase64ToUint8Array } from '../services/audioUtils';

interface FileViewerProps {
  note: Note;
  onClose: () => void;
  onPageChange?: (page: number) => void;
}

declare global {
    interface Window {
        pdfjsLib: any;
    }
}

const FileViewer: React.FC<FileViewerProps> = ({ note, onClose, onPageChange }) => {
  // Shared State
  const [pageIndex, setPageIndex] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1.2);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // PDF Specific Refs & State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  // Reset on note change
  useEffect(() => {
    setPageIndex(0);
    setNumPages(0);
    setError(null);
    setZoom(1.2);
    if(onPageChange) onPageChange(0);

    if (note.type === NoteType.PDF) {
        loadPdf();
    } else if (note.structuredData) {
        setNumPages(note.structuredData.length);
    }
  }, [note]);

  // Sync page change to parent
  useEffect(() => {
      if (onPageChange) onPageChange(pageIndex + 1);
  }, [pageIndex]);

  // --- Custom PDF Loader ---
  const loadPdf = async () => {
      if (!window.pdfjsLib) {
          setError("PDF Reader library not loaded. Please check connection.");
          return;
      }
      
      setIsLoading(true);
      try {
          // Clean and decode Base64
          const cleanContent = note.content.replace(/[\r\n\s]/g, '');
          const uint8Array = decodeBase64ToUint8Array(cleanContent);

          const loadingTask = window.pdfjsLib.getDocument({ data: uint8Array });
          const pdf = await loadingTask.promise;
          
          pdfDocRef.current = pdf;
          setNumPages(pdf.numPages);
          setPageIndex(0);
          renderPdfPage(1); // Render first page
      } catch (e) {
          console.error("PDF Load Error", e);
          setError("Failed to render PDF document. File may be corrupted.");
      } finally {
          setIsLoading(false);
      }
  };

  const renderPdfPage = async (pageNum: number) => {
      if (!pdfDocRef.current || !canvasRef.current) return;

      try {
          // Cancel previous render if exists
          if (renderTaskRef.current) {
              renderTaskRef.current.cancel();
          }

          const page = await pdfDocRef.current.getPage(pageNum);
          const viewport = page.getViewport({ scale: zoom });
          
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const renderContext = {
              canvasContext: context,
              viewport: viewport
          };

          const renderTask = page.render(renderContext);
          renderTaskRef.current = renderTask;
          
          await renderTask.promise;
      } catch (e: any) {
          if (e.name !== 'RenderingCancelledException') {
              console.error("Page Render Error", e);
          }
      }
  };

  // Re-render PDF when Page or Zoom changes
  useEffect(() => {
      if (note.type === NoteType.PDF && pdfDocRef.current) {
          renderPdfPage(pageIndex + 1);
      }
  }, [pageIndex, zoom, note.type]);


  // --- Navigation Handlers ---
  const handleNext = () => {
      if (pageIndex < numPages - 1) {
          setPageIndex(prev => prev + 1);
      }
  };

  const handlePrev = () => {
      if (pageIndex > 0) {
          setPageIndex(prev => prev - 1);
      }
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.2, 3.0));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.5));

  // --- Render ---
  return (
    <div className="h-full flex flex-col bg-[#131314] animate-fade-in relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1e1f20] border-b border-[#444746] shadow-sm z-20">
            <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-10 h-10 rounded-lg bg-[#2d2e31] flex items-center justify-center border border-[#444746] text-primary shrink-0">
                    <span className="text-[10px] font-bold uppercase">{note.type}</span>
                </div>
                <h3 className="text-white font-medium text-lg truncate">{note.fileName || 'Untitled Note'}</h3>
            </div>
            <div className="flex items-center gap-2">
                {/* Zoom Controls (PDF Only) */}
                {note.type === NoteType.PDF && (
                    <div className="flex items-center bg-[#2d2e31] rounded-lg mr-4 border border-[#444746]">
                        <button onClick={handleZoomOut} className="p-2 hover:bg-white/5 text-gray-400 hover:text-white transition-colors border-r border-[#444746]">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <span className="w-12 text-center text-xs font-mono text-gray-300">{Math.round(zoom * 100)}%</span>
                        <button onClick={handleZoomIn} className="p-2 hover:bg-white/5 text-gray-400 hover:text-white transition-colors border-l border-[#444746]">
                             <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                    </div>
                )}
                <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
        </div>

        {/* Main Viewer Area */}
        <div className="flex-1 overflow-auto p-6 relative bg-[#0f1011] custom-scrollbar flex items-start justify-center">
            
            {/* Image Viewer */}
            {note.type === NoteType.IMAGE && (
                <div className="flex items-center justify-center min-h-full w-full">
                    <img src={`data:image/png;base64,${note.content}`} alt="Note" className="max-w-full max-h-full rounded-lg shadow-2xl border border-[#444746]" />
                </div>
            )}

            {/* Custom PDF Viewer */}
            {note.type === NoteType.PDF && (
                <div className="relative shadow-2xl border border-[#2d2e31]">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#0f1011] z-10">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                    {error ? (
                         <div className="flex flex-col items-center justify-center text-red-400 p-10 text-center">
                             <svg className="w-12 h-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                             <p>{error}</p>
                         </div>
                    ) : (
                        <canvas ref={canvasRef} className="block bg-white max-w-full" />
                    )}
                </div>
            )}

            {/* Custom PPTX / Text Viewer */}
            {note.type === NoteType.TEXT && note.structuredData && (
                <div className="w-full max-w-5xl bg-white text-black p-12 rounded-2xl shadow-2xl min-h-[600px] flex flex-col border-4 border-gray-300 relative mb-24">
                     <div className="absolute top-6 right-6 text-gray-400 text-sm font-mono font-bold bg-gray-100 px-3 py-1 rounded-full">Slide {pageIndex + 1} / {numPages}</div>
                     
                     <div className="flex-1 flex flex-col items-center justify-center text-center border-b-2 border-gray-100 pb-8 mb-8">
                         <h2 className="text-3xl font-bold mb-6 whitespace-pre-wrap text-gray-800 leading-tight">{note.structuredData[pageIndex].content || "(No Text on Slide)"}</h2>
                     </div>
                     
                     {note.structuredData[pageIndex].note && (
                         <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-xl text-gray-800 shadow-sm">
                             <span className="font-bold block mb-2 uppercase text-xs tracking-widest text-yellow-700">Speaker Notes</span>
                             <p className="text-lg leading-relaxed">{note.structuredData[pageIndex].note}</p>
                         </div>
                     )}
                </div>
            )}

            {/* Raw Text Fallback */}
            {note.type === NoteType.TEXT && !note.structuredData && (
                <div className="max-w-3xl w-full mx-auto bg-[#1e1f20] p-10 rounded-2xl border border-[#444746] shadow-lg min-h-full">
                    <pre className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed text-lg">{note.content}</pre>
                </div>
            )}
        </div>

        {/* Floating Controls (Shared for PDF & PPTX) */}
        {(note.type === NoteType.PDF || (note.type === NoteType.TEXT && note.structuredData)) && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 z-30 pointer-events-none">
                 <div className="bg-[#1e1f20]/90 backdrop-blur border border-[#444746] p-2 rounded-full shadow-2xl flex items-center gap-4 pointer-events-auto">
                     <button 
                        onClick={handlePrev}
                        disabled={pageIndex === 0}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white disabled:opacity-30 transition-all"
                     >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
                     </button>
                     
                     <div className="font-mono text-sm font-medium text-gray-300 min-w-[80px] text-center select-none">
                         {pageIndex + 1} <span className="text-gray-600 mx-1">/</span> {numPages}
                     </div>

                     <button 
                        onClick={handleNext}
                        disabled={pageIndex === numPages - 1}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white disabled:opacity-30 transition-all"
                     >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
                     </button>
                 </div>
            </div>
        )}
    </div>
  );
};

export default FileViewer;

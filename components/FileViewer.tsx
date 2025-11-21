import React, { useState, useEffect, useRef } from 'react';
import { Note, NoteType } from '../types';
import { decodeBase64ToUint8Array } from '../services/audioUtils';
import { Button } from '@/components/ui/Button.tsx';
import { Card, CardContent } from '@/components/ui/Card.tsx';
import { ZoomIn, ZoomOut, X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

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
          const cleanContent = note.content.replace(/[
\s]/g, '');
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
    <div className="h-full flex flex-col bg-background animate-fade-in relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-card/80 backdrop-blur-md border-b z-20">
            <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center border text-primary shrink-0">
                    <span className="text-[10px] font-bold uppercase">{note.type}</span>
                </div>
                <h3 className="font-medium text-lg truncate">{note.fileName || 'Untitled Note'}</h3>
            </div>
            <div className="flex items-center gap-2">
                {/* Zoom Controls (PDF Only) */}
                {note.type === NoteType.PDF && (
                    <div className="flex items-center bg-muted rounded-lg mr-4 border">
                        <Button variant="ghost" size="icon" onClick={handleZoomOut} className="border-r rounded-none">
                            <ZoomOut className="w-4 h-4" />
                        </Button>
                        <span className="w-12 text-center text-xs font-mono">{Math.round(zoom * 100)}%</span>
                        <Button variant="ghost" size="icon" onClick={handleZoomIn} className="border-l rounded-none">
                            <ZoomIn className="w-4 h-4" />
                        </Button>
                    </div>
                )}
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="w-5 h-5" />
                </Button>
            </div>
        </div>

        {/* Main Viewer Area */}
        <div className="flex-1 overflow-auto p-6 relative bg-muted/20 custom-scrollbar flex items-start justify-center">
            
            {/* Image Viewer */}
            {note.type === NoteType.IMAGE && (
                <div className="flex items-center justify-center min-h-full w-full">
                    <img src={`data:image/png;base64,${note.content}`} alt="Note" className="max-w-full max-h-full rounded-lg shadow-2xl border" />
                </div>
            )}

            {/* Custom PDF Viewer */}
            {note.type === NoteType.PDF && (
                <Card className="relative shadow-2xl">
                    <CardContent className="p-0">
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                        {error ? (
                             <div className="flex flex-col items-center justify-center text-destructive p-10 text-center">
                                 <AlertCircle className="w-12 h-12 mb-4" />
                                 <p>{error}</p>
                             </div>
                        ) : (
                            <canvas ref={canvasRef} className="block bg-white max-w-full" />
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Custom PPTX / Text Viewer */}
            {note.type === NoteType.TEXT && note.structuredData && (
                <Card className="w-full max-w-5xl shadow-2xl min-h-[600px] mb-24">
                     <CardContent className="p-12 flex flex-col">
                        <div className="absolute top-6 right-6 text-muted-foreground text-sm font-mono font-bold bg-muted px-3 py-1 rounded-full">Slide {pageIndex + 1} / {numPages}</div>
                        
                        <div className="flex-1 flex flex-col items-center justify-center text-center border-b-2 pb-8 mb-8">
                            <h2 className="text-3xl font-bold mb-6 whitespace-pre-wrap leading-tight">{note.structuredData[pageIndex].content || "(No Text on Slide)"}</h2>
                        </div>
                        
                        {note.structuredData[pageIndex].note && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-xl text-yellow-900 shadow-sm">
                                <span className="font-bold block mb-2 uppercase text-xs tracking-widest text-yellow-700">Speaker Notes</span>
                                <p className="text-lg leading-relaxed">{note.structuredData[pageIndex].note}</p>
                            </div>
                        )}
                     </CardContent>
                </Card>
            )}

            {/* Raw Text Fallback */}
            {note.type === NoteType.TEXT && !note.structuredData && (
                <Card className="max-w-3xl w-full mx-auto shadow-lg min-h-full">
                    <CardContent className="p-10">
                        <pre className="whitespace-pre-wrap font-sans text-lg">{note.content}</pre>
                    </CardContent>
                </Card>
            )}
        </div>

        {/* Floating Controls (Shared for PDF & PPTX) */}
        {(note.type === NoteType.PDF || (note.type === NoteType.TEXT && note.structuredData)) && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 z-30 pointer-events-none">
                 <div className="bg-card/90 backdrop-blur border p-2 rounded-full shadow-2xl flex items-center gap-4 pointer-events-auto">
                     <Button 
                        onClick={handlePrev}
                        disabled={pageIndex === 0}
                        variant="ghost"
                        size="icon"
                     >
                         <ChevronLeft className="w-5 h-5" />
                     </Button>
                     
                     <div className="font-mono text-sm font-medium min-w-[80px] text-center select-none">
                         {pageIndex + 1} <span className="text-muted-foreground mx-1">/</span> {numPages}
                     </div>

                     <Button 
                        onClick={handleNext}
                        disabled={pageIndex === numPages - 1}
                        variant="ghost"
                        size="icon"
                     >
                         <ChevronRight className="w-5 h-5" />
                     </Button>
                 </div>
            </div>
        )}
    </div>
  );
};

export default FileViewer;
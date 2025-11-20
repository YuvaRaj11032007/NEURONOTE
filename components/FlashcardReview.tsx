
import React, { useState } from 'react';
import { Flashcard } from '../types';

interface FlashcardReviewProps {
  flashcards: Flashcard[];
  onGenerate: () => void;
  isLoading: boolean;
}

const FlashcardReview: React.FC<FlashcardReviewProps> = ({ flashcards, onGenerate, isLoading }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!flashcards || flashcards.length === 0) {
      return (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8">
               <div className="w-16 h-16 bg-surfaceHighlight rounded-2xl flex items-center justify-center mb-4">
                   <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M9 3v18"></path></svg>
               </div>
               <h3 className="text-xl text-white font-medium mb-2">No Flashcards Yet</h3>
               <p className="mb-6 text-center max-w-md">Generate a set of flashcards from your notes to start memorizing key concepts.</p>
               <button 
                  onClick={onGenerate}
                  disabled={isLoading}
                  className="px-6 py-3 bg-primary text-dark font-medium rounded-full hover:bg-blue-300 transition-colors flex items-center gap-2"
               >
                  {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-dark border-t-transparent rounded-full animate-spin"></div>
                        Generating...
                      </>
                  ) : (
                      <>Generate Flashcards</>
                  )}
               </button>
          </div>
      );
  }

  const currentCard = flashcards[currentIndex];

  const nextCard = () => {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => (prev + 1) % flashcards.length), 200);
  };

  const prevCard = () => {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => (prev - 1 + flashcards.length) % flashcards.length), 200);
  };

  return (
    <div className="max-w-4xl mx-auto pt-10 px-6 flex flex-col h-full">
         <div className="flex justify-between items-center mb-8">
             <h3 className="text-2xl text-white font-medium">Flashcards</h3>
             <span className="bg-surfaceHighlight px-3 py-1 rounded-full text-sm text-gray-400">
                 {currentIndex + 1} / {flashcards.length}
             </span>
         </div>

         <div className="flex-1 flex items-center justify-center perspective-1000 relative min-h-[400px]">
             {/* Card Container */}
             <div 
                className={`relative w-full max-w-2xl aspect-[3/2] cursor-pointer transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
                onClick={() => setIsFlipped(!isFlipped)}
             >
                 {/* Front */}
                 <div className="absolute inset-0 bg-surface border border-border rounded-3xl p-10 flex flex-col items-center justify-center text-center backface-hidden shadow-2xl hover:border-primary/50 transition-colors">
                     <span className="absolute top-6 left-6 text-xs font-bold text-primary tracking-widest uppercase">Front</span>
                     <h4 className="text-3xl font-medium text-white">{currentCard.front}</h4>
                     <div className="absolute bottom-6 text-gray-500 text-sm">Tap to flip</div>
                 </div>

                 {/* Back */}
                 <div className="absolute inset-0 bg-[#2d2e31] border border-gray-600 rounded-3xl p-10 flex flex-col items-center justify-center text-center backface-hidden rotate-y-180 shadow-2xl">
                     <span className="absolute top-6 left-6 text-xs font-bold text-green-400 tracking-widest uppercase">Back</span>
                     <p className="text-xl text-gray-200 leading-relaxed">{currentCard.back}</p>
                 </div>
             </div>

             {/* Controls */}
             <div className="absolute bottom-0 left-0 right-0 translate-y-full pt-8 flex items-center justify-center gap-6">
                 <button onClick={prevCard} className="p-3 rounded-full bg-surface border border-border text-gray-400 hover:text-white hover:bg-surfaceHighlight transition-colors">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                 </button>
                 
                 <button 
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="px-8 py-3 rounded-xl bg-surfaceHighlight text-white font-medium hover:bg-gray-700 transition-colors"
                 >
                     {isFlipped ? 'Show Question' : 'Reveal Answer'}
                 </button>

                 <button onClick={nextCard} className="p-3 rounded-full bg-surface border border-border text-gray-400 hover:text-white hover:bg-surfaceHighlight transition-colors">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                 </button>
             </div>
         </div>
         
         <style>{`
            .perspective-1000 { perspective: 1000px; }
            .transform-style-3d { transform-style: preserve-3d; }
            .backface-hidden { backface-visibility: hidden; }
            .rotate-y-180 { transform: rotateY(180deg); }
         `}</style>
    </div>
  );
};

export default FlashcardReview;

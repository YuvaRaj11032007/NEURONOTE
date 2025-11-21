import React, { useState } from 'react';
import { Flashcard } from '../types';
import { Button } from '@/components/ui/Button.tsx';
import { Card, CardContent } from '@/components/ui/Card.tsx';
import { Layers, ChevronLeft, ChevronRight } from 'lucide-react';

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
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
               <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                   <Layers className="w-8 h-8 text-primary" />
               </div>
               <h3 className="text-xl text-foreground font-medium mb-2">No Flashcards Yet</h3>
               <p className="mb-6 text-center max-w-md">Generate a set of flashcards from your notes to start memorizing key concepts.</p>
               <Button 
                  onClick={onGenerate}
                  disabled={isLoading}
               >
                  {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
                        Generating...
                      </>
                  ) : (
                      <>Generate Flashcards</>
                  )}
               </Button>
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
             <h3 className="text-2xl font-medium">Flashcards</h3>
             <span className="bg-muted px-3 py-1 rounded-full text-sm">
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
                 <Card className="absolute inset-0 flex flex-col items-center justify-center text-center backface-hidden shadow-2xl">
                     <CardContent className="p-10">
                        <span className="absolute top-6 left-6 text-xs font-bold text-primary tracking-widest uppercase">Front</span>
                        <h4 className="text-3xl font-medium">{currentCard.front}</h4>
                        <div className="absolute bottom-6 text-muted-foreground text-sm">Tap to flip</div>
                     </CardContent>
                 </Card>

                 {/* Back */}
                <Card className="absolute inset-0 flex flex-col items-center justify-center text-center backface-hidden rotate-y-180 shadow-2xl bg-secondary">
                     <CardContent className="p-10">
                        <span className="absolute top-6 left-6 text-xs font-bold text-green-400 tracking-widest uppercase">Back</span>
                        <p className="text-xl leading-relaxed">{currentCard.back}</p>
                     </CardContent>
                 </Card>
             </div>

             {/* Controls */}
             <div className="absolute bottom-0 left-0 right-0 translate-y-full pt-8 flex items-center justify-center gap-6">
                 <Button onClick={prevCard} variant="outline" size="icon">
                    <ChevronLeft className="w-6 h-6" />
                 </Button>
                 
                 <Button 
                    onClick={() => setIsFlipped(!isFlipped)}
                    variant="secondary"
                    className="px-8 py-3"
                 >
                     {isFlipped ? 'Show Question' : 'Reveal Answer'}
                 </Button>

                 <Button onClick={nextCard} variant="outline" size="icon">
                    <ChevronRight className="w-6 h-6" />
                 </Button>
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
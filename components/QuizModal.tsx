import React, { useState, useEffect } from 'react';
import { QuizQuestion } from '../types';
import { Button } from '@/components/ui/Button.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog.tsx';
import { Progress } from '@/components/ui/Progress.tsx';
import { X, Check, Award } from 'lucide-react';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: QuizQuestion[];
  onComplete?: (score: number) => void;
}

const QuizModal: React.FC<QuizModalProps> = ({ isOpen, onClose, questions, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setScore(0);
      setIsFinished(false);
      setSelectedOption(null);
      setShowResult(false);
    }
  }, [isOpen, questions]);

  // Call onComplete when finished
  useEffect(() => {
    if (isFinished && onComplete) {
      onComplete(score);
    }
  }, [isFinished]);

  if (!isOpen || !questions || questions.length === 0) return null;

  const currentQ = questions[currentIndex];

  const handleAnswer = (idx: number) => {
    if (showResult) return;
    setSelectedOption(idx);
    setShowResult(true);
    if (idx === currentQ.correctAnswerIndex) {
      setScore(s => s + 1);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(p => p + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      setIsFinished(true);
    }
  };

  if (isFinished) {
      const percentage = Math.round((score / questions.length) * 100);
      return (
        <Dialog open={isFinished} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center">Quiz Completed!</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center text-center p-4">
                    <div className="relative w-32 h-32 mb-4">
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                            <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeDasharray={`${percentage * 2.51} 251`} strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-4xl font-bold">{percentage}%</span>
                    </div>
                    <p className="text-lg text-muted-foreground">You scored <span className="font-bold text-foreground">{score}</span> out of {questions.length}</p>
                </div>
                <DialogFooter>
                    <Button onClick={onClose} className="w-full">Back to Dashboard</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-0">
                <div className="flex justify-between items-center">
                    <DialogTitle>Test your knowledge</DialogTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-4 pt-4">
                    <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-2" />
                    <span className="text-sm text-muted-foreground">{currentIndex + 1} / {questions.length}</span>
                </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <h3 className="text-2xl font-medium mb-8 leading-relaxed">{currentQ.question}</h3>

                <div className="space-y-3">
                  {currentQ.options.map((opt, idx) => {
                    let stateClass = "bg-secondary hover:bg-secondary/80 text-secondary-foreground";
                    let icon = <span className="w-8 h-8 rounded-full bg-muted border flex items-center justify-center text-sm font-medium mr-4 transition-colors group-hover:border-primary group-hover:text-primary">{String.fromCharCode(65 + idx)}</span>;

                    if (showResult) {
                      if (idx === currentQ.correctAnswerIndex) {
                          stateClass = "bg-green-900/20 border-green-500/50 text-green-100 ring-1 ring-green-500/50";
                          icon = <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-black mr-4 shadow-lg shadow-green-500/20"><Check className="w-4 h-4" /></div>;
                      } else if (idx === selectedOption) {
                          stateClass = "bg-red-900/20 border-red-500/50 text-red-100 ring-1 ring-red-500/50";
                          icon = <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white mr-4 shadow-lg shadow-red-500/20"><X className="w-4 h-4" /></div>;
                      } else {
                          stateClass = "bg-secondary opacity-40 grayscale";
                      }
                    } else if (selectedOption === idx) {
                        stateClass = "bg-primary/10 border-primary text-primary ring-1 ring-primary";
                    }

                    return (
                      <Button
                        key={idx}
                        onClick={() => handleAnswer(idx)}
                        variant="outline"
                        className={`w-full p-4 h-auto text-left justify-start rounded-2xl border-2 transition-all duration-200 group ${stateClass}`}
                        disabled={showResult}
                      >
                        {icon}
                        <span className="text-lg font-normal">{opt}</span>
                      </Button>
                    );
                  })}
                </div>
            </div>

            {showResult && (
                <DialogFooter className="p-6 bg-muted/40 border-t">
                    <div className="flex-1">
                        <span className="text-xs font-bold text-muted-foreground uppercase">Explanation</span>
                        <p className="text-sm mt-1 leading-relaxed">{currentQ.explanation}</p>
                    </div>
                    <Button 
                        onClick={nextQuestion}
                        className="whitespace-nowrap w-full sm:w-auto mt-4 sm:mt-0"
                    >
                        {currentIndex === questions.length - 1 ? 'See Results' : 'Next Question'}
                    </Button>
                </DialogFooter>
            )}
        </DialogContent>
    </Dialog>
  );
};

export default QuizModal;

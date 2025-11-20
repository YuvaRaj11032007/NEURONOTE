import React, { useState, useEffect } from 'react';
import { QuizQuestion } from '../types';

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
  const progress = ((currentIndex) / questions.length) * 100;

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
        <div className="fixed inset-0 z-50 bg-dark/95 flex items-center justify-center p-4 animate-fade-in backdrop-blur-lg">
             <div className="bg-surface w-full max-w-md rounded-3xl p-10 border border-border shadow-2xl text-center relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-500"></div>
                 
                 <div className="w-32 h-32 rounded-full bg-surfaceHighlight mx-auto flex items-center justify-center mb-8 border-8 border-dark shadow-inner relative">
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#444746" strokeWidth="8" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#8ab4f8" strokeWidth="8" strokeDasharray={`${percentage * 2.51} 251`} strokeLinecap="round" />
                    </svg>
                    <span className="text-4xl font-bold text-white">{percentage}%</span>
                 </div>

                 <h2 className="text-3xl text-white font-medium mb-2">Quiz Completed!</h2>
                 <p className="text-gray-400 mb-8 text-lg">You scored <span className="text-white font-bold">{score}</span> out of {questions.length}</p>
                 
                 <button onClick={onClose} className="w-full py-4 bg-primary text-dark font-bold text-lg rounded-2xl hover:bg-blue-300 transition-all transform hover:scale-[1.02]">
                     Back to Dashboard
                 </button>
             </div>
        </div>
      )
  }

  return (
    <div className="fixed inset-0 z-50 bg-dark/95 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-surface w-full max-w-3xl rounded-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Top Progress Bar */}
        <div className="h-1.5 w-full bg-surfaceHighlight">
            <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}></div>
        </div>

        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex justify-between items-start">
          <div>
             <span className="text-xs font-bold text-primary/80 uppercase tracking-widest mb-1 block">Question {currentIndex + 1} / {questions.length}</span>
             <h3 className="text-white text-xl font-medium">Test your knowledge</h3>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-surfaceHighlight flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500/20 transition-all">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
            <h3 className="text-2xl text-white font-medium mb-8 leading-relaxed mt-4">{currentQ.question}</h3>

            <div className="space-y-3">
              {currentQ.options.map((opt, idx) => {
                let stateClass = "bg-[#2a2b2e] border-transparent hover:bg-[#35363a] text-gray-200";
                let icon = <span className="w-8 h-8 rounded-full bg-surfaceHighlight border border-gray-600 flex items-center justify-center text-sm font-medium text-gray-400 mr-4 transition-colors group-hover:border-gray-400 group-hover:text-white">{String.fromCharCode(65 + idx)}</span>;

                if (showResult) {
                  if (idx === currentQ.correctAnswerIndex) {
                      stateClass = "bg-green-900/20 border-green-500/50 text-green-100 ring-1 ring-green-500/50";
                      icon = <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-black mr-4 shadow-lg shadow-green-500/20"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>;
                  } else if (idx === selectedOption) {
                      stateClass = "bg-red-900/20 border-red-500/50 text-red-100 ring-1 ring-red-500/50";
                      icon = <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white mr-4 shadow-lg shadow-red-500/20"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>;
                  } else {
                      stateClass = "bg-[#2a2b2e] opacity-40 grayscale";
                  }
                } else if (selectedOption === idx) {
                    stateClass = "bg-primary/10 border-primary text-primary ring-1 ring-primary";
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    className={`w-full p-4 text-left rounded-2xl border-2 transition-all duration-200 flex items-center group ${stateClass}`}
                    disabled={showResult}
                  >
                    {icon}
                    <span className="text-lg font-normal">{opt}</span>
                  </button>
                );
              })}
            </div>
        </div>

        {/* Footer / Explanation */}
        {showResult && (
            <div className="p-6 bg-[#252629] border-t border-border animate-slide-up flex flex-col sm:flex-row items-center gap-6 z-10">
                <div className="flex-1">
                    <span className="text-xs font-bold text-gray-400 uppercase">Explanation</span>
                    <p className="text-white text-sm mt-1 leading-relaxed">{currentQ.explanation}</p>
                </div>
                <button 
                    onClick={nextQuestion}
                    className="px-8 py-3 bg-primary text-dark font-bold rounded-xl hover:bg-blue-300 transition-colors shadow-lg shadow-primary/20 whitespace-nowrap w-full sm:w-auto"
                >
                    {currentIndex === questions.length - 1 ? 'See Results' : 'Next Question'}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default QuizModal;
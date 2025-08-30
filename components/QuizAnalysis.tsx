import React from 'react';
import { QuizAnalysisData, QuestionBreakdown } from '../types';
import { CheckCircleIcon, XCircleIcon } from './Icons';

interface QuizAnalysisProps {
  analysis: QuizAnalysisData;
}

const ScoreChart: React.FC<{ breakdown: QuestionBreakdown[] }> = ({ breakdown }) => {
  const totalQuestions = breakdown.length;
  const correctAnswers = breakdown.filter(q => q.isCorrect).length;
  const incorrectAnswers = totalQuestions - correctAnswers;
  const correctPercentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

  return (
    <div className="my-4">
      <div className="flex w-full h-4 bg-red-500/50 rounded-full overflow-hidden">
        <div 
          className="bg-green-500 h-full transition-all duration-500 ease-out" 
          style={{ width: `${correctPercentage}%` }}
        ></div>
      </div>
      <div className="flex justify-between text-xs mt-1.5 text-gray-300">
        <span>{correctAnswers} Correct</span>
        <span>{incorrectAnswers} Incorrect</span>
      </div>
    </div>
  );
};


const QuestionBreakdownItem: React.FC<{ item: QuestionBreakdown, index: number }> = ({ item, index }) => {
    return (
        <div className="p-3 bg-gray-600/50 rounded-lg">
            <p className="font-semibold text-gray-200 mb-2">Q{index + 1}: {item.questionText}</p>
            <div className="space-y-2 text-xs">
                <div className="flex items-start">
                    <span className="font-bold text-gray-400 w-20">Your Answer:</span>
                    <span className="flex-1">{item.userAnswer}</span>
                </div>
                <div className="flex items-start">
                    <span className="font-bold text-gray-400 w-20">Correct is:</span>
                    <span className="flex-1 text-green-400">{item.correctAnswer}</span>
                </div>
                <div className="flex items-start pt-1 mt-1 border-t border-gray-500/50">
                    <span className="font-bold text-gray-400 w-20">Reason:</span>
                    <span className="flex-1 text-gray-300">{item.justification}</span>
                </div>
            </div>
        </div>
    );
}

export const QuizAnalysis: React.FC<QuizAnalysisProps> = ({ analysis }) => {
  return (
    <div className="space-y-4 text-white">
      <h3 className="text-lg font-bold text-center">{analysis.headline}</h3>
      
      <ScoreChart breakdown={analysis.questionBreakdown} />

      <div>
        <h4 className="font-semibold mb-2">Overall Feedback</h4>
        <p className="text-sm text-gray-300">{analysis.overallFeedback}</p>
      </div>
      
      <hr className="border-gray-600"/>

      <div>
        <h4 className="font-semibold mb-2">Question Breakdown</h4>
        <div className="space-y-3">
          {analysis.questionBreakdown.map((item, index) => (
            <div key={index} className="flex items-start space-x-3">
                {item.isCorrect 
                    ? <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5"/> 
                    : <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"/>
                }
                <QuestionBreakdownItem item={item} index={index} />
            </div>
          ))}
        </div>
      </div>

      <hr className="border-gray-600"/>

      <div>
        <h4 className="font-semibold mb-2">Next Steps</h4>
        <p className="text-sm text-gray-300">{analysis.nextSteps}</p>
      </div>

    </div>
  );
};
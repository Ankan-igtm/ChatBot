import React from 'react';

interface QuizOptionsProps {
  options: string[];
  onOptionClick: (optionIndex: number, optionText: string) => void;
  disabled?: boolean;
  selectedOption?: number;
}

export const QuizOptions: React.FC<QuizOptionsProps> = ({ options, onOptionClick, disabled, selectedOption }) => {
  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      {options.map((option, index) => {
        const isSelected = index === selectedOption;
        
        return (
          <button
            key={index}
            onClick={() => onOptionClick(index, option)}
            disabled={disabled}
            className={`flex items-start text-left p-3 rounded-lg transition-all duration-300 ease-in-out transform 
                       ${disabled ? 'cursor-not-allowed' : 'hover:bg-gray-500 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500'}
                       ${isSelected ? 'bg-blue-600 ring-2 ring-blue-400 text-white' : 'bg-gray-600'}
                       ${disabled && !isSelected ? 'opacity-50' : ''}
                      `}
          >
            <span className="font-bold mr-2">{optionLabels[index]}:</span>
            <span>{option}</span>
          </button>
        )
      })}
    </div>
  );
};
import React from 'react';
import { BotIcon } from './Icons';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-start space-x-4">
        <BotIcon className="w-8 h-8 p-1.5 rounded-full bg-gray-600" />
      <div className="flex items-center space-x-2 bg-gray-700 p-4 rounded-r-xl rounded-bl-xl">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
      </div>
    </div>
  );
};

import React from 'react';
import { ChatMessageData, ChatSender } from '../types';
import { BotIcon, UserIcon } from './Icons';
import { QuizOptions } from './QuizOptions';
import { QuizAnalysis } from './QuizAnalysis';

interface ChatMessageProps {
  message: ChatMessageData;
  onOptionClick: (optionIndex: number, optionText: string) => void;
}

// Simple markdown parser for bold and lists
const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const processLine = (line: string, index: number) => {
    // Bold: **text**
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Unordered list: * item or - item
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      return <li key={index} dangerouslySetInnerHTML={{ __html: line.trim().substring(2) }} />;
    }
    
    // Headers: ### text
    if (line.trim().startsWith('### ')) {
      return <h3 key={index} className="text-lg font-semibold mt-4 mb-2" dangerouslySetInnerHTML={{ __html: line.trim().substring(4) }} />;
    }

    if (line.trim().startsWith('#### ')) {
      return <h4 key={index} className="text-md font-semibold mt-3 mb-1" dangerouslySetInnerHTML={{ __html: line.trim().substring(5) }} />;
    }

    // Horizontal Rule: ---
    if (line.trim() === '---') {
        return <hr key={index} className="my-4 border-gray-600" />;
    }

    return <p key={index} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: line }} />;
  };

  const lines = text.split('\n');
  let inList = false;
  const elements: JSX.Element[] = [];

  lines.forEach((line, index) => {
    const isListItem = line.trim().startsWith('* ') || line.trim().startsWith('- ');
    if (isListItem && !inList) {
      inList = true;
      elements.push(<ul key={`ul-start-${index}`} className="list-disc list-inside space-y-1 my-2">{processLine(line, index)}</ul>);
    } else if (isListItem && inList) {
      const list = elements[elements.length - 1];
      const existingChildren = Array.isArray(list.props.children)
        ? list.props.children
        : [list.props.children];
      elements[elements.length - 1] = React.cloneElement(list, {
        children: [...existingChildren, processLine(line, index)],
      });
    } else {
      inList = false;
      elements.push(processLine(line, index));
    }
  });

  return <>{elements}</>;
};


export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onOptionClick }) => {
  const isBot = message.sender === ChatSender.BOT;

  const messageContainerClasses = isBot 
    ? "flex items-start space-x-4" 
    : "flex items-start justify-end space-x-reverse space-x-4";
  
  const bubbleClasses = isBot
    ? "bg-gray-700 rounded-r-xl rounded-bl-xl"
    : "bg-blue-600 text-white rounded-l-xl rounded-br-xl";

  const Icon = isBot ? BotIcon : UserIcon;

  return (
    <div className={`${messageContainerClasses} animate-fade-in-up`}>
      <div className="flex-shrink-0">
        <Icon className="w-8 h-8 p-1.5 rounded-full bg-gray-600" />
      </div>
      <div className={`max-w-xl p-4 text-sm ${bubbleClasses}`}>
        {message.analysis ? (
          <QuizAnalysis analysis={message.analysis} />
        ) : (
          <SimpleMarkdown text={message.text} />
        )}
        {message.options && (
          <QuizOptions
            options={message.options}
            onOptionClick={onOptionClick}
            disabled={message.quizAnswered}
            selectedOption={message.selectedOption}
          />
        )}
      </div>
    </div>
  );
};
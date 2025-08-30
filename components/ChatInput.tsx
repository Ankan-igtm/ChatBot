import React, { useState, useEffect, useRef } from 'react';
import { SendIcon, MicrophoneIcon } from './Icons';

// FIX: Add type definitions for the Web Speech API to resolve TypeScript errors.
// These interfaces are not part of standard TS DOM typings.
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionStatic {
  new(): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionStatic;
    webkitSpeechRecognition?: SpeechRecognitionStatic;
  }
}

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled: boolean;
  onListenStart?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled, onListenStart }) => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop listening automatically after a pause
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      finalTranscriptRef.current = ''; // Reset on new result

      for (let i = 0; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcriptPart;
        } else {
          interimTranscript += transcriptPart;
        }
      }
      setText(finalTranscriptRef.current + interimTranscript);
    };

    recognition.onend = () => {
      setIsListening(false);
      const messageToSend = finalTranscriptRef.current.trim();
      if (messageToSend) {
        onSendMessage(messageToSend);
        setText('');
        finalTranscriptRef.current = '';
      }
    };
    
    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.onstart = null;
            recognitionRef.current.onresult = null;
            recognitionRef.current.onend = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.stop();
        }
    }
  }, [onSendMessage]);

  const handleToggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      onListenStart?.();
      setText('');
      finalTranscriptRef.current = '';
      recognitionRef.current?.start();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSendMessage(text);
      setText('');
    }
  };
  
  const getPlaceholderText = () => {
      if (disabled) return "Waiting for response...";
      if (isListening) return "Listening... speak now";
      return "Type or say your message...";
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-3">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={getPlaceholderText()}
        disabled={disabled}
        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
        autoComplete="off"
      />
      {recognitionRef.current && (
        <button
            type="button"
            onClick={handleToggleListening}
            disabled={disabled}
            className={`p-2.5 rounded-full ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-600 hover:bg-gray-500'} disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition duration-200`}
        >
            <MicrophoneIcon className="w-5 h-5" />
        </button>
      )}
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition duration-200"
      >
        <SendIcon className="w-5 h-5" />
      </button>
    </form>
  );
};
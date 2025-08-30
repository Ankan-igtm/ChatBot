import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chat } from '@google/genai';
import { ChatMessageData, ChatSender, ChatState, QuizQuestion, QuizSession, RoadmapStep } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { LoadingSpinner } from './components/LoadingSpinner';
import { BotIcon, SpeakerOnIcon, SpeakerOffIcon } from './components/Icons';
import * as geminiService from './services/geminiService';
import * as ttsService from './services/ttsService';

export default function App() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [chatState, setChatState] = useState<ChatState>(ChatState.INITIAL);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState<boolean>(true);
  
  // User context
  const [studentName, setStudentName] = useState<string>('');
  const [classLevel, setClassLevel] = useState<string>('');
  const [stream, setStream] = useState<string>('');

  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [geminiChat, setGeminiChat] = useState<Chat | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Cleanup TTS on component unmount
  useEffect(() => {
    return () => {
      ttsService.cancel();
    };
  }, []);
  
  const speakBotMessage = useCallback((text: string) => {
      if (isTtsEnabled && text) {
          // A simple regex to strip markdown for cleaner speech
          const cleanText = text.replace(/(\*\*|### |#### |---|\* )/g, '');
          ttsService.speak(cleanText);
      }
  }, [isTtsEnabled]);

  const addMessage = useCallback((sender: ChatSender, text: string, options?: string[], analysis?: ChatMessageData['analysis'], roadmap?: RoadmapStep[]) => {
    setMessages(prev => [...prev, { sender, text, options, analysis, roadmap }]);
    if (sender === ChatSender.BOT) {
        if (analysis) {
             const analysisText = `${analysis.headline}. ${analysis.overallFeedback}. ${analysis.nextSteps}`;
             speakBotMessage(analysisText);
        } else if (roadmap) {
            speakBotMessage("Here is a personalized 12-month roadmap to get you started.");
        } else {
            speakBotMessage(text);
        }
    }
  }, [speakBotMessage]);

  const startConversation = useCallback(() => {
    setIsLoading(true);
    const initialMessage = `Hi there! 👋 I’m your career guidance assistant. To get started, could you please tell me your name?`;
    addMessage(ChatSender.BOT, initialMessage);
    setChatState(ChatState.AWAITING_NAME);
    setIsLoading(false);
  }, [addMessage]);

  useEffect(() => {
    if (chatState === ChatState.INITIAL) {
        startConversation();
    }
  }, [chatState, startConversation]);

  const sanitizeInput = (text: string): string => {
    const words = text.trim().split(/\s+/);
    const uniqueWords = words.filter((word, index) => {
      // Keep the word if it's the first word, or if it's different from the previous word (case-insensitive)
      return index === 0 || word.toLowerCase() !== words[index - 1].toLowerCase();
    });
    return uniqueWords.join(' ');
  };

  const generateAndDisplayDomainGuide = async (domain: string) => {
    addMessage(ChatSender.BOT, `Awesome! I'm putting together a detailed guide and a personalized roadmap for **${domain}**. One moment...`);
    setIsLoading(true);

    try {
      const details = await geminiService.getDomainDetails(domain);
      addMessage(ChatSender.BOT, details);
      
      const roadmapSteps = await geminiService.getDomainRoadmap(domain);
      addMessage(ChatSender.BOT, '', undefined, undefined, roadmapSteps);
      
      promptForFinalFeedback(domain);
    } catch (error) {
      console.error("Error generating domain guide:", error);
      addMessage(ChatSender.BOT, "Sorry, I had trouble generating the guide for that domain. Please try another one.");
      setChatState(ChatState.AWAITING_INTERESTED_DOMAIN);
    } finally {
      setIsLoading(false);
    }
  }

  const handleUserMessage = async (rawText: string) => {
    if (isLoading) return;

    const text = sanitizeInput(rawText);

    // Prevent sending duplicate consecutive messages
    const lastUserMessage = [...messages].reverse().find(m => m.sender === ChatSender.USER);
    if (lastUserMessage && lastUserMessage.text.trim().toLowerCase() === text.trim().toLowerCase()) {
      return; // Silently ignore the duplicate message
    }

    addMessage(ChatSender.USER, text);
    setIsLoading(true);

    try {
      switch (chatState) {
        case ChatState.AWAITING_NAME: {
          const extractedName = await geminiService.extractNameFromText(text);
          setStudentName(extractedName);
          const botReply = `Great to meet you, ${extractedName}! Are you currently in Class 10 or Class 12?`;
          addMessage(ChatSender.BOT, botReply);
          setChatState(ChatState.AWAITING_CLASS_LEVEL);
          break;
        }

        case ChatState.AWAITING_CLASS_LEVEL: {
          const level = text.toLowerCase();
          if (level.includes('10')) {
            setClassLevel('Class 10');
            const botReply = `Perfect. Now, can you tell me what domain was predicted for you by our website?`;
            addMessage(ChatSender.BOT, botReply);
            setChatState(ChatState.AWAITING_PREDICTED_DOMAIN);
          } else if (level.includes('12')) {
            setClassLevel('Class 12');
            const botReply = `Thanks! And which stream are you in? (e.g., Science, Commerce, Arts)`;
            addMessage(ChatSender.BOT, botReply);
            setChatState(ChatState.AWAITING_STREAM);
          } else {
            addMessage(ChatSender.BOT, "Please tell me if you're in 'Class 10' or 'Class 12'.");
          }
          break;
        }
        
        case ChatState.AWAITING_STREAM: {
            const validation = await geminiService.validateStream(text);
            if (validation.isValid && validation.streamName) {
                setStream(validation.streamName);
                const botReply = `Got it, ${validation.streamName} stream. Now, can you tell me what domain was predicted for you by our website?`;
                addMessage(ChatSender.BOT, botReply);
                setChatState(ChatState.AWAITING_PREDICTED_DOMAIN);
            } else {
                const botReply = "That doesn't seem like a valid academic stream. Please tell me your stream, such as Science, Commerce, or Arts.";
                addMessage(ChatSender.BOT, botReply);
            }
            break;
        }

        case ChatState.AWAITING_PREDICTED_DOMAIN: {
          const validation = await geminiService.validateDomain(text);
          if (validation.isValid && validation.domainName) {
              const predictedDomain = validation.domainName;
              setQuizSession({ predictedDomain, userAnswers: [] });
              const botReply = `So your predicted domain is **${predictedDomain}**. Are you satisfied with this domain, or would you like to explore other options? (Reply ‘Satisfied’ or ‘Not satisfied’.)`;
              addMessage(ChatSender.BOT, botReply);
              setChatState(ChatState.AWAITING_SATISFACTION);
          } else {
              const botReply = "That doesn't seem to be a valid career domain. Please tell me the domain that was predicted for you by our website (e.g., Data Science, Design, Accounting).";
              addMessage(ChatSender.BOT, botReply);
          }
          break;
        }

        case ChatState.AWAITING_SATISFACTION: {
          const lowerCaseText = text.toLowerCase();
          if (lowerCaseText.includes('satisfied') && !lowerCaseText.includes('not')) {
            const domain = quizSession!.predictedDomain!;
            await generateAndDisplayDomainGuide(domain);
          } else {
            const botReply = 'No problem! Which domains interest you most? You can name 1–2 (e.g., Data Science, Design, Accounting).';
            addMessage(ChatSender.BOT, botReply);
            setChatState(ChatState.AWAITING_INTERESTED_DOMAIN);
          }
          break;
        }

        case ChatState.AWAITING_INTERESTED_DOMAIN: {
          const validation = await geminiService.validateDomain(text);
          if (validation.isValid && validation.domainName) {
            const interestedDomain = validation.domainName;
            setQuizSession(prev => ({ ...prev!, interestedDomain }));
            const botReply = `Great! Let's explore **${interestedDomain}**. I'll ask you 5 short multiple-choice questions to see if it's a good fit. Ready?`;
            addMessage(ChatSender.BOT, botReply);
            setChatState(ChatState.GENERATING_QUIZ);
            const questions = await geminiService.getQuizQuestions(interestedDomain);
            setQuizSession(prev => ({ ...prev!, questions }));
            setChatState(ChatState.IN_QUIZ);
            presentQuestion(questions, 0);
          } else {
            const botReply = "That doesn't seem to be a valid career domain. Please name 1-2 domains you're interested in (e.g., Data Science, Design, Accounting).";
            addMessage(ChatSender.BOT, botReply);
          }
          break;
        }
        
        case ChatState.AWAITING_ADJACENT_CHOICE: {
            const validation = await geminiService.validateDomain(text);
            if (validation.isValid && validation.domainName) {
                await generateAndDisplayDomainGuide(validation.domainName);
            } else {
                const botReply = "Please choose one of the suggested domains, or name another one you're interested in.";
                addMessage(ChatSender.BOT, botReply);
            }
            break;
        }
        
        case ChatState.AWAITING_FINAL_FEEDBACK: {
            const isPositive = await geminiService.isPositiveFeedback(text);
            if (isPositive) {
              startFollowUpConversation();
            } else {
              const botReply = 'No problem at all! Exploring is what this is all about. Which other domains interest you most? You can name 1–2 (e.g., Data Science, Design, Accounting).';
              addMessage(ChatSender.BOT, botReply);
              setChatState(ChatState.AWAITING_INTERESTED_DOMAIN);
            }
            break;
        }

        case ChatState.POST_GUIDANCE_CHAT: {
            if (geminiChat) {
                const response = await geminiChat.sendMessage({ message: text });
                addMessage(ChatSender.BOT, response.text);
            } else {
                 addMessage(ChatSender.BOT, "Sorry, I can't continue the conversation right now. Please refresh the page to start over.");
            }
            break;
        }
      }
    } catch (error) {
      console.error(error);
      addMessage(ChatSender.BOT, 'Sorry, something went wrong. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const presentQuestion = (questions: QuizQuestion[], index: number) => {
      if (!questions || index >= questions.length) return;
      const q = questions[index];
      const questionText = `**Question ${index + 1}/${questions.length}**: ${q.question}`;
      addMessage(ChatSender.BOT, questionText, q.options);
  };

  const promptForFinalFeedback = (domain: string) => {
    const botReply = `So, what do you think? Does this sound like a good path for you, or would you prefer to explore a different domain?`;
    addMessage(ChatSender.BOT, botReply);
    setChatState(ChatState.AWAITING_FINAL_FEEDBACK);
  };

  const startFollowUpConversation = () => {
    const botReply = "I'm glad this was helpful! Feel free to ask me any more questions you have.";
    addMessage(ChatSender.BOT, botReply);
    const chat = geminiService.startFollowUpChat();
    setGeminiChat(chat);
    setChatState(ChatState.POST_GUIDANCE_CHAT);
  };

  const handleQuizAnswer = async (optionIndex: number, optionText: string) => {
    if (!quizSession || !quizSession.questions) return;
    
    // Disable options on the message and add user's answer
    setMessages(prev => {
        const newMessages = [...prev];
        let lastBotMessageWithOptionsIndex = -1;
        // Use a reverse loop for efficiency
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].sender === ChatSender.BOT && newMessages[i].options) {
            lastBotMessageWithOptionsIndex = i;
            break;
          }
        }

        if (lastBotMessageWithOptionsIndex !== -1) {
          newMessages[lastBotMessageWithOptionsIndex] = {
            ...newMessages[lastBotMessageWithOptionsIndex],
            quizAnswered: true,
            selectedOption: optionIndex,
          };
        }
        return [...newMessages, { sender: ChatSender.USER, text: optionText }];
    });
    
    setIsLoading(true);

    const updatedUserAnswers = [...quizSession.userAnswers, optionIndex];
    const currentQuestionIndex = updatedUserAnswers.length -1;
    
    const newQuizSession = { ...quizSession, userAnswers: updatedUserAnswers };
    setQuizSession(newQuizSession);

    await new Promise(resolve => setTimeout(resolve, 500));

    if (updatedUserAnswers.length < quizSession.questions.length) {
      presentQuestion(quizSession.questions, currentQuestionIndex + 1);
      setIsLoading(false);
    } else {
      setChatState(ChatState.ANALYZING_QUIZ);
      addMessage(ChatSender.BOT, "Thanks! Let me analyze your results...");
      
      try {
        const analysisResult = await geminiService.getQuizAnalysis(newQuizSession);
      
        addMessage(ChatSender.BOT, '', undefined, analysisResult.data);

        if (analysisResult.isGoodFit) {
          const domain = newQuizSession.interestedDomain!;
          await generateAndDisplayDomainGuide(domain);
        } else {
          // The 'nextSteps' text is already in the analysis data, so we just wait for user input
          setChatState(ChatState.AWAITING_ADJACENT_CHOICE);
        }
      } catch (error) {
        console.error("Error during quiz analysis:", error);
        addMessage(ChatSender.BOT, "I had some trouble analyzing your results. Let's try exploring a domain directly. Which one interests you?");
        setChatState(ChatState.AWAITING_INTERESTED_DOMAIN);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isQuizActive = chatState === ChatState.IN_QUIZ && quizSession?.questions != null;

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 min-h-screen flex flex-col items-center justify-center p-4 font-sans text-white">
      <div className="w-full max-w-3xl h-[90vh] flex flex-col bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700">
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center">
            <BotIcon className="w-10 h-10 mr-4" />
            <div>
              <h1 className="text-xl font-bold">Career Guidance Assistant</h1>
              <p className="text-sm text-gray-400">
                  {studentName ? `Guiding ${studentName}` : 'Your personal guide to a bright future'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsTtsEnabled(prev => !prev)}
            className="p-2 rounded-full text-gray-300 hover:bg-gray-700 transition-colors"
            aria-label={isTtsEnabled ? 'Disable voice' : 'Enable voice'}
          >
            {isTtsEnabled ? <SpeakerOnIcon className="w-6 h-6" /> : <SpeakerOffIcon className="w-6 h-6" />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, index) => (
            <ChatMessage key={index} message={msg} onOptionClick={handleQuizAnswer} />
          ))}
          {isLoading && <LoadingSpinner />}
          <div ref={chatEndRef} />
        </main>

        <footer className="p-4 border-t border-gray-700">
          {isQuizActive ? (
            <div className="text-center text-gray-400">Please select an option above.</div>
          ) : (
            <ChatInput 
              onSendMessage={handleUserMessage} 
              disabled={isLoading || chatState === ChatState.IN_QUIZ}
              onListenStart={ttsService.cancel}
            />
          )}
        </footer>
      </div>
    </div>
  );
}
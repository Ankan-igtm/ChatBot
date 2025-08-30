export enum ChatSender {
  USER = 'user',
  BOT = 'bot',
}

export interface ChatMessageData {
  sender: ChatSender;
  text: string;
  options?: string[];
  quizAnswered?: boolean;
  selectedOption?: number;
  analysis?: QuizAnalysisData;
}

export enum ChatState {
  INITIAL,
  AWAITING_NAME,
  AWAITING_CLASS_LEVEL,
  AWAITING_STREAM,
  AWAITING_PREDICTED_DOMAIN,
  AWAITING_SATISFACTION,
  AWAITING_INTERESTED_DOMAIN,
  GENERATING_QUIZ,
  IN_QUIZ,
  ANALYZING_QUIZ,
  AWAITING_ADJACENT_CHOICE,
  GENERATING_DETAILS,
  POST_GUIDANCE_CHAT,
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface QuizSession {
  predictedDomain?: string;
  interestedDomain?: string;
  questions?: QuizQuestion[];
  userAnswers: number[];
}

// For structured quiz analysis
export interface QuestionBreakdown {
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  justification: string;
  isCorrect: boolean;
}

export interface QuizAnalysisData {
  headline: string;
  overallFeedback: string;
  questionBreakdown: QuestionBreakdown[];
  nextSteps: string;
}
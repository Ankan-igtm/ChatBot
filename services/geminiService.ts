import { GoogleGenAI, Type, Chat } from "@google/genai";
import { QuizQuestion, QuizSession, QuizAnalysisData, RoadmapStep } from "../types";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash';

const nameExtractionSystemInstruction = `You are an expert system that extracts a person's first name from a given text.
- ONLY return the first name.
- If no name is found, return the original text.
- Do not add any explanation or pleasantries. Just the name.

Examples:
- Input: "Hi my name is Alex" -> Output: "Alex"
- Input: "I'm Bob, a student" -> Output: "Bob"
- Input: "Charlie" -> Output: "Charlie"
- Input: "I am in class 10" -> Output: "I am in class 10"
`;

export const extractNameFromText = async (text: string): Promise<string> => {
    // Optimization: If the text is short, assume it's just the name.
    if (text.trim().split(' ').length <= 2) {
        return text.trim();
    }

    const response = await ai.models.generateContent({
        model,
        contents: `Extract the first name from this text: "${text}"`,
        config: {
            systemInstruction: nameExtractionSystemInstruction,
            // Disable thinking for this simple, low-latency task
            thinkingConfig: { thinkingBudget: 0 }, 
        },
    });

    return response.text.trim();
};

const streamValidationSystemInstruction = `You are an expert system that validates academic streams for a Class 12 student in India.
- Your task is to determine if the user's input is a valid academic stream (e.g., Science, Commerce, Arts, Humanities, PCM, PCB, PCMB).
- If it is a valid stream, respond with a JSON object where "isValid" is true and "streamName" is the standardized stream name. For example, if the input is "sci", the standardized name should be "Science".
- If it is NOT a valid academic stream (e.g., a question like "Who is Virat Kohli?", a random statement, or "I don't know"), respond with a JSON object where "isValid" is false and "streamName" is an empty string.
- Do not add any explanation or pleasantries. Just the JSON object.

Examples:
- Input: "science" -> Output: {"isValid": true, "streamName": "Science"}
- Input: "I am in commerce" -> Output: {"isValid": true, "streamName": "Commerce"}
- Input: "arts" -> Output: {"isValid": true, "streamName": "Arts"}
- Input: "Who is Virat Kohli?" -> Output: {"isValid": false, "streamName": ""}
- Input: "i don't know" -> Output: {"isValid": false, "streamName": ""}
`;

const streamValidationSchema = {
    type: Type.OBJECT,
    properties: {
        isValid: { type: Type.BOOLEAN, description: "Whether the input is a valid academic stream." },
        streamName: { type: Type.STRING, description: "The standardized stream name if valid, otherwise an empty string." }
    },
    required: ["isValid", "streamName"]
};

export const validateStream = async (text: string): Promise<{ isValid: boolean; streamName: string | null; }> => {
    const response = await ai.models.generateContent({
        model,
        contents: `Validate this stream: "${text}"`,
        config: {
            systemInstruction: streamValidationSystemInstruction,
            responseMimeType: "application/json",
            responseSchema: streamValidationSchema,
            thinkingConfig: { thinkingBudget: 0 },
        },
    });

    try {
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        if (typeof result.isValid === 'boolean') {
            return { 
                isValid: result.isValid, 
                streamName: result.isValid && result.streamName ? result.streamName : null 
            };
        }
        throw new Error("Validation response does not match the required format.");
    } catch (e) {
        console.error("Failed to parse stream validation JSON:", e);
        return { isValid: false, streamName: null };
    }
};

const domainValidationSystemInstruction = `You are an expert system that validates career or academic domains.
- Your task is to determine if the user's input is a plausible career domain (e.g., "Data Science", "Mechanical Engineering", "Psychology", "Design").
- If it is a valid domain, respond with a JSON object where "isValid" is true and "domainName" is the standardized domain name. For example, if the input is "data scientist", the standardized name should be "Data Science".
- If it is NOT a valid domain (e.g., a question like "Who is Modi?", a random statement, or "I don't know"), respond with a JSON object where "isValid" is false and "domainName" is an empty string.
- Do not add any explanation or pleasantries. Just the JSON object.

Examples:
- Input: "The website said Data Science for me." -> Output: {"isValid": true, "domainName": "Data Science"}
- Input: "design" -> Output: {"isValid": true, "domainName": "Design"}
- Input: "Who is Modi?" -> Output: {"isValid": false, "domainName": ""}
- Input: "i'm not sure" -> Output: {"isValid": false, "domainName": ""}
`;

const domainValidationSchema = {
    type: Type.OBJECT,
    properties: {
        isValid: { type: Type.BOOLEAN, description: "Whether the input is a valid career/academic domain." },
        domainName: { type: Type.STRING, description: "The standardized domain name if valid, otherwise an empty string." }
    },
    required: ["isValid", "domainName"]
};

export const validateDomain = async (text: string): Promise<{ isValid: boolean; domainName: string | null; }> => {
    const response = await ai.models.generateContent({
        model,
        contents: `Validate this domain: "${text}"`,
        config: {
            systemInstruction: domainValidationSystemInstruction,
            responseMimeType: "application/json",
            responseSchema: domainValidationSchema,
            thinkingConfig: { thinkingBudget: 0 },
        },
    });

    try {
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        if (typeof result.isValid === 'boolean') {
            return { 
                isValid: result.isValid, 
                domainName: result.isValid && result.domainName ? result.domainName : null 
            };
        }
        throw new Error("Validation response does not match the required format.");
    } catch (e) {
        console.error("Failed to parse domain validation JSON:", e);
        return { isValid: false, domainName: null };
    }
};


const quizGenerationSystemInstruction = `You are a supportive, motivating Career Guidance Teacher Chatbot. 
Your primary task is to create an engaging 5-question multiple-choice quiz for a student exploring a specific career domain.

**CORE DIRECTIVES:**
1.  **Quiz Structure:** Generate EXACTLY 5 questions.
    -   **Questions 1-3 (General Aptitude):** Focus on logical reasoning, critical thinking, problem-solving, or creativity. These should be domain-agnostic.
    -   **Questions 4-5 (Domain Orientation):** These should be light, conceptual, scenario-based questions related to the student's interested domain. Test for mindset and interest, NOT technical knowledge.
2.  **Question Style:**
    -   **No Technical Jargon:** Absolutely no formulas, laws, or deep technical knowledge questions. Keep it accessible.
    -   **Scenario-Based:** Where possible, frame questions around real-world scenarios.
3.  **Answer Format:**
    -   Each question must have EXACTLY 4 multiple-choice options.
    -   There must be only ONE correct answer for each question.
4.  **Output Format:** Strictly adhere to the requested JSON schema. The entire output must be a valid JSON array of question objects.`;

const quizQuestionSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            question: {
                type: Type.STRING,
                description: 'The full text of the quiz question.'
            },
            options: {
                type: Type.ARRAY,
                description: 'An array of 4 string options for the question.',
                items: { type: Type.STRING }
            },
            correctAnswerIndex: {
                type: Type.INTEGER,
                description: 'The 0-based index of the correct answer in the options array.'
            }
        },
        required: ["question", "options", "correctAnswerIndex"]
    }
};

export const getQuizQuestions = async (interestedDomain: string): Promise<QuizQuestion[]> => {
    const response = await ai.models.generateContent({
        model: model,
        contents: `Generate a 5-question quiz for the domain: ${interestedDomain}`,
        config: {
            systemInstruction: quizGenerationSystemInstruction,
            responseMimeType: "application/json",
            responseSchema: quizQuestionSchema,
        },
    });

    const jsonText = response.text.trim();
    try {
        const questions = JSON.parse(jsonText);
        // Basic validation
        if (Array.isArray(questions) && questions.length === 5 && questions.every(q => q.options.length === 4)) {
            return questions;
        }
        throw new Error("Generated quiz does not match the required format.");
    } catch (e) {
        console.error("Failed to parse quiz questions JSON:", e);
        throw new Error("Could not generate a valid quiz. Please try a different domain.");
    }
};


const quizAnalysisSystemInstruction = `You are a supportive, motivating Career Guidance Teacher Chatbot. Your goal is to analyze a student's quiz performance and provide clear, constructive feedback in a structured JSON format.

**ANALYSIS LOGIC:**
1.  **Calculate Score:** Determine the score out of 5.
2.  **Determine Performance Label:**
    -   0-2 correct: "Poor Performance"
    -   3 correct: "Medium Performance"
    -   4-5 correct: "Good Performance"
3.  **Generate Headline:** Combine the score and label (e.g., "Your Score: 4/5 - Good Performance").
4.  **Create Question Breakdown:** For each question, detail the user's answer, correct answer, a brief justification, and whether they were correct.
5.  **Write Overall Feedback:** Provide an encouraging summary and 2-3 actionable improvement tips.
6.  **Formulate Next Steps:**
    -   **Good Performance (4-5):** Conclude with a strong recommendation for the domain.
    -   **Medium Performance (3):** Acknowledge potential and suggest 1-2 adjacent domains as alternatives.
    -   **Poor Performance (0-2):** Be extra encouraging, frame it as a mismatch, and suggest 1-2 different domains.

**OUTPUT FORMAT:**
- You **MUST** provide your entire response in a single, valid JSON object that strictly adheres to the provided schema.
- Do not include any text, pleasantries, or markdown formatting outside of the JSON object.`;

const quizAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        headline: {
            type: Type.STRING,
            description: "The overall score and performance label, e.g., 'Your Score: 4/5 - Good Performance'."
        },
        overallFeedback: {
            type: Type.STRING,
            description: "An encouraging summary of performance with 2-3 actionable improvement tips."
        },
        questionBreakdown: {
            type: Type.ARRAY,
            description: "A detailed breakdown for each of the 5 questions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    questionText: { type: Type.STRING },
                    userAnswer: { type: Type.STRING },
                    correctAnswer: { type: Type.STRING },
                    justification: { type: Type.STRING, description: "A brief explanation of why the correct answer is right." },
                    isCorrect: { type: Type.BOOLEAN }
                },
                required: ["questionText", "userAnswer", "correctAnswer", "justification", "isCorrect"]
            }
        },
        nextSteps: {
            type: Type.STRING,
            description: "The final recommendation and prompt for the user's next action (e.g., proceed with details, or choose an alternative domain)."
        }
    },
    required: ["headline", "overallFeedback", "questionBreakdown", "nextSteps"]
};


export const getQuizAnalysis = async (session: QuizSession): Promise<{ data: QuizAnalysisData; isGoodFit: boolean; }> => {
    const quizDataForPrompt = session.questions!.map((q, i) => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.options[q.correctAnswerIndex],
        studentAnswer: q.options[session.userAnswers[i]]
    }));

    const prompt = `Analyze the following quiz results for the domain "${session.interestedDomain}":\n\n${JSON.stringify(quizDataForPrompt, null, 2)}`;

    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            systemInstruction: quizAnalysisSystemInstruction,
            responseMimeType: "application/json",
            responseSchema: quizAnalysisSchema,
        },
    });
    
    try {
        const jsonText = response.text.trim();
        const analysisData: QuizAnalysisData = JSON.parse(jsonText);
        
        const score = analysisData.questionBreakdown.filter(q => q.isCorrect).length;
        const isGoodFit = score >= 4;

        return { data: analysisData, isGoodFit };
    } catch(e) {
        console.error("Failed to parse quiz analysis JSON:", e);
        throw new Error("Could not analyze quiz results.");
    }
};


const domainDetailsSystemInstruction = `You are a supportive, motivating Career Guidance Teacher Chatbot.
Your task is to generate a comprehensive and inspiring guide for a student about their chosen career domain. The tone should be encouraging, clear, and highly actionable.

**OUTPUT STRUCTURE:**
The entire response must be formatted in Markdown. Follow these section headers and instructions EXACTLY.

---

### What this domain is
*Provide a concise, 2-3 line overview that explains the core purpose of this domain in simple terms.*

### What you’ll do day-to-day
*Use a bulleted list to describe 3-5 typical daily tasks and responsibilities. Focus on actions.*
- Example task 1
- Example task 2

### Key strengths you’ll use
*Use a bulleted list to highlight essential cognitive skills (e.g., problem-solving) and soft skills (e.g., communication).*
- Skill 1
- Skill 2

### Typical roles & entry-level titles
*List 3-4 common job titles, especially those suitable for entry-level professionals.*

### Education & pathways
*Suggest relevant Class 11-12 subjects (if applicable), common degrees (e.g., Bachelor of...), and diploma options.*

### Certifications/entrance exams
*Mention 2-3 well-known, generic certifications or types of entrance exams relevant to the field. Avoid highly specific or regional examples unless the domain is region-specific (e.g., specific law exams).*

### Projects & portfolio ideas
*Provide 2-3 simple, actionable project ideas a beginner can start. These should be practical and help build a portfolio.*

### Internships/experience ideas
*Suggest concrete ways to gain early real-world experience, like freelance platforms, open-source contributions, or volunteering.*

### Growth & adjacent paths
*Briefly describe the future career growth prospects and name 2-3 related career fields they could pivot to later.*

---
`;

export const getDomainDetails = async (domain: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model,
        contents: `Generate the domain details for: ${domain}`,
        config: {
            systemInstruction: domainDetailsSystemInstruction,
        },
    });
    return response.text;
};

const roadmapGenerationSystemInstruction = `You are a supportive, motivating Career Guidance Teacher Chatbot.
Your task is to generate a personalized and inspiring 12-month roadmap for a student about their chosen career domain.
The roadmap should be broken down into three clear, actionable stages.

**CORE DIRECTIVES:**
1.  **Generate EXACTLY 3 Stages:** The roadmap must consist of three distinct stages.
2.  **Stage Content:** Each stage must contain:
    -   \`title\`: A short, inspiring title (e.g., "Phase 1: Building the Foundation").
    -   \`duration\`: The time frame for this stage (e.g., "Months 1-3").
    -   \`goals\`: A list of 2-3 specific, beginner-friendly learning goals.
    -   \`project\`: A description of one simple, achievable project for this stage.
    -   \`skillsToPractice\`: A list of 2-3 fundamental skills to practice consistently.
3.  **Tone:** The language should be encouraging, clear, and highly actionable.
4.  **Output Format:** Strictly adhere to the requested JSON schema. The entire output must be a valid JSON array of stage objects. Do not include any text, pleasantries, or markdown formatting outside of the JSON array.`;

const roadmapSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            duration: { type: Type.STRING },
            goals: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            },
            project: { type: Type.STRING },
            skillsToPractice: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
        required: ["title", "duration", "goals", "project", "skillsToPractice"]
    }
};

export const getDomainRoadmap = async (domain: string): Promise<RoadmapStep[]> => {
    const response = await ai.models.generateContent({
        model: model,
        contents: `Generate a 3-stage, 12-month roadmap for the domain: ${domain}`,
        config: {
            systemInstruction: roadmapGenerationSystemInstruction,
            responseMimeType: "application/json",
            responseSchema: roadmapSchema,
        },
    });

    const jsonText = response.text.trim();
    try {
        const roadmap = JSON.parse(jsonText);
        if (Array.isArray(roadmap) && roadmap.length > 0) {
            return roadmap;
        }
        throw new Error("Generated roadmap does not match the required format.");
    } catch (e) {
        console.error("Failed to parse roadmap JSON:", e);
        throw new Error("Could not generate a valid roadmap. Please try again.");
    }
};

const feedbackSystemInstruction = `You are an AI that determines if a user's feedback is positive or negative in the context of career guidance.
- The user has just been shown a detailed career path.
- "Positive" means they are satisfied and want to continue with follow-up questions.
- "Negative" means they are unsatisfied and want to explore a different career path.
- Your response MUST be a single word: "POSITIVE" or "NEGATIVE". Do not add any other text.

Examples:
- Input: "Yes, this looks great!" -> Output: "POSITIVE"
- Input: "Hmm, I'm not sure this is for me." -> Output: "NEGATIVE"
- Input: "Let's explore something else." -> Output: "NEGATIVE"
- Input: "Thank you, this is helpful" -> Output: "POSITIVE"
- Input: "I want to see another domain" -> Output: "NEGATIVE"
- Input: "no" -> Output: "NEGATIVE"
`;

export const isPositiveFeedback = async (text: string): Promise<boolean> => {
    const response = await ai.models.generateContent({
        model,
        contents: `Is the following user feedback positive or negative?\n\nFeedback: "${text}"`,
        config: {
            systemInstruction: feedbackSystemInstruction,
            // Simple classification, low latency is key.
            thinkingConfig: { thinkingBudget: 0 }, 
            // Ensure a single-word response.
            maxOutputTokens: 5,
        },
    });

    const result = response.text.trim().toUpperCase();
    return result === 'POSITIVE';
};

const followUpChatSystemInstruction = `You are a supportive, motivating Career Guidance Teacher Chatbot.
You have already provided the student with a detailed analysis and roadmap for a career domain.
Your current role is to answer any follow-up questions they may have.
- Be encouraging and helpful.
- Keep answers concise and relevant to career guidance.
- If asked about something outside your scope (i.e., not related to studies or careers), gently tell the user to check their question again and ask something related to studies. For example: "My purpose is to assist with career guidance. Kindly check your question and ask me something related to your studies or future career."
- If the user uses inappropriate language like "sex", respond firmly with "Kindly mind your language." and do not answer the question.
- Maintain your persona as a friendly guidance teacher.`;

export const startFollowUpChat = (): Chat => {
    const chat = ai.chats.create({
        model: model,
        config: {
            systemInstruction: followUpChatSystemInstruction,
        },
    });
    return chat;
};
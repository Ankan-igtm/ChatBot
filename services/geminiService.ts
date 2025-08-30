import { GoogleGenAI, Type, Chat } from "@google/genai";
import { QuizQuestion, QuizSession, QuizAnalysisData } from "../types";

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

const domainExtractionSystemInstruction = `You are an expert system that extracts a career domain from a given text.
- ONLY return the career domain name.
- The domain should be concise and standardized (e.g., "Data Science", "Mechanical Engineering", "Psychology").
- If no clear domain is found, return the original text.
- Do not add any explanation or pleasantries. Just the domain name.

Examples:
- Input: "it's predicted me for science" -> Output: "Science"
- Input: "The website said Data Science for me." -> Output: "Data Science"
- Input: "design" -> Output: "Design"
- Input: "I am interested in becoming a doctor" -> Output: "Medicine"
- Input: "I'm not sure" -> Output: "I'm not sure"
`;

export const extractDomainFromText = async (text: string): Promise<string> => {
    // Optimization: If the text is short, assume it's just the domain.
    if (text.trim().split(' ').length <= 3) {
        return text.trim();
    }
    
    const response = await ai.models.generateContent({
        model,
        contents: `Extract the career domain from this text: "${text}"`,
        config: {
            systemInstruction: domainExtractionSystemInstruction,
            thinkingConfig: { thinkingBudget: 0 }, 
        },
    });

    return response.text.trim();
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

### Your 12-Month Roadmap
*This section should be a clear, step-by-step plan.*

#### **Next 1–3 months:**
*Outline beginner-friendly learning goals and suggest one tiny, achievable project.*

#### **Next 6 months:**
*Describe intermediate concepts to tackle and propose a slightly more complex capstone project.*

#### **Next 12 months:**
*Set a goal for real-world exposure, such as applying for an internship, participating in a competition, or freelancing.*

#### **Skills to practice weekly:**
*List 2-3 fundamental skills (e.g., logic puzzles, writing, a specific software) to practice consistently.*

#### **Resources:**
*Suggest 3-5 TYPES of resources, not just specific links. For example: "Online courses (Coursera, Udemy)", "Interactive coding platforms (freeCodeCamp)", "Professional communities (LinkedIn groups, Discord servers)".*`;

export const getDomainDetailsAndRoadmap = async (domain: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model,
        contents: `Generate the domain details and roadmap for: ${domain}`,
        config: {
            systemInstruction: domainDetailsSystemInstruction,
        },
    });
    return response.text;
};

const followUpChatSystemInstruction = `You are a supportive, motivating Career Guidance Teacher Chatbot.
You have already provided the student with a detailed analysis and roadmap for a career domain.
Your current role is to answer any follow-up questions they may have.
- Be encouraging and helpful.
- Keep answers concise and relevant to career guidance.
- If asked about something outside your scope, gently guide the conversation back to careers.
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
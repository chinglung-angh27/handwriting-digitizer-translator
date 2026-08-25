
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("⚠️ WARNING: GEMINI_API_KEY is not set. API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToGenerativePart = (base64: string, mimeType: string) => {
    return {
        inlineData: {
            data: base64,
            mimeType
        },
    };
};

export const extractTextFromImage = async (base64Image: string, mimeType: string): Promise<string> => {
    try {
        const imagePart = fileToGenerativePart(base64Image, mimeType);
        // Updated prompt to extract ANY visible text (printed or handwritten)
        const textPart = { text: "Perform OCR on this image and extract ALL visible text (printed or handwritten) exactly as it appears, preserving line breaks and ordering. The text may be in multiple languages (e.g., English, Hindi, Kannada). Return only the extracted text." };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
        });

        const text = response.text;
        if (!text) {
            throw new Error("Could not extract any text from the image.");
        }
        return text;
    } catch (error) {
        console.error("Error extracting text from image:", error);
        throw new Error("Gemini API failed to extract text.");
    }
};

export const translateText = async (textToTranslate: string, targetLanguage: string): Promise<string> => {
    try {
        const prompt = `Translate the following text to ${targetLanguage}:\n\n"${textToTranslate}"\n\nOnly return the translated text.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        const text = response.text;
         if (!text) {
            throw new Error("Could not translate the text.");
        }
        return text;
    } catch (error) {
        console.error(`Error translating text to ${targetLanguage}:`, error);
        throw new Error(`Gemini API failed to translate text.`);
    }
};
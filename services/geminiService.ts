
// Client-side Gemini access goes through the serverless proxy at /api/gemini.
// The API key lives only on the server (Netlify env vars) — never in this bundle.

const callGemini = async (contents: unknown): Promise<string> => {
    let res: Response;
    try {
        res = await fetch("/api/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents }),
        });
    } catch (error) {
        console.error("Network error contacting Gemini proxy:", error);
        throw new Error("Could not reach the AI service. Check your connection and try again.");
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        console.error("Gemini proxy error:", data?.error || res.status);
        throw new Error(data?.error || `AI service error (HTTP ${res.status}).`);
    }
    return data.text as string;
};

export const extractTextFromImage = async (base64Image: string, mimeType: string): Promise<string> => {
    try {
        // Updated prompt to extract ANY visible text (printed or handwritten)
        const promptText = "Perform OCR on this image and extract ALL visible text (printed or handwritten) exactly as it appears, preserving line breaks and ordering. The text may be in multiple languages (e.g., English, Hindi, Kannada). Return only the extracted text.";

        const text = await callGemini({
            parts: [
                { inlineData: { data: base64Image, mimeType } },
                { text: promptText },
            ],
        });

        if (!text) {
            throw new Error("Could not extract any text from the image.");
        }
        return text;
    } catch (error) {
        if (error instanceof Error && !error.message.startsWith("Gemini API failed")) {
            throw error; // preserve specific errors from the proxy
        }
        console.error("Error extracting text from image:", error);
        throw new Error("Gemini API failed to extract text.");
    }
};

export const translateText = async (textToTranslate: string, targetLanguage: string): Promise<string> => {
    try {
        const prompt = `Translate the following text to ${targetLanguage}:\n\n"${textToTranslate}"\n\nOnly return the translated text.`;

        const text = await callGemini(prompt);

        if (!text) {
            throw new Error("Could not translate the text.");
        }
        return text;
    } catch (error) {
        if (error instanceof Error && !error.message.startsWith("Gemini API failed")) {
            throw error;
        }
        console.error(`Error translating text to ${targetLanguage}:`, error);
        throw new Error(`Gemini API failed to translate text.`);
    }
};

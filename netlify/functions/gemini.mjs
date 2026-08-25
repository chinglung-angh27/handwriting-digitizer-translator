// Netlify Function: secure server-side proxy for AI OCR + translation.
// API keys live only in process.env (Netlify env vars) — never in the client bundle.
//
// Provider switch: if OPENROUTER_API_KEY is set, requests go through OpenRouter
// (free-tier vision models). Otherwise falls back to Gemini with GEMINI_API_KEY.

const OPENROUTER_MODEL = "google/gemma-4-31b-it:free";
const GEMINI_MODEL = "gemini-3.6-flash";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  body: JSON.stringify(body),
});

// Convert Gemini-style contents ({parts:[{text}|{inlineData}]}) into the
// OpenRouter/OpenAI chat format (messages with text / image_url parts).
const toOpenRouterMessages = (contents) => {
  const parts = Array.isArray(contents) ? contents.flatMap((c) => c.parts || []) : contents.parts || [];
  const content = parts.map((p) =>
    p.text
      ? { type: "text", text: p.text }
      : {
          type: "image_url",
          image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` },
        },
  );
  return [{ role: "user", content }];
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  if (!payload || !payload.contents) {
    return json(400, { error: "Missing 'contents' in request body." });
  }

  // REST API needs contents = array of {parts:[...]}. SDK accepted raw strings;
  // raw HTTP does not — normalize here so both shapes work.
  let contents = payload.contents;
  if (typeof contents === "string") {
    contents = [{ parts: [{ text: contents }] }];
  } else if (!Array.isArray(contents) && contents.parts) {
    contents = [contents];
  }

  const useOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const apiKey = useOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error(
      useOpenRouter
        ? "OPENROUTER_API_KEY set but empty."
        : "GEMINI_API_KEY is not configured in Netlify environment variables.",
    );
    return json(500, { error: "Server configuration error: API key missing." });
  }

  const promptText = contents[0]?.parts?.find((p) => p.text)?.text;

  try {
    let text = "";

    if (useOpenRouter) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: toOpenRouterMessages(contents),
          max_tokens: 2048,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data?.error?.message || `OpenRouter API error (HTTP ${res.status})`;
        console.error("OpenRouter API error:", message);
        return json(res.status === 429 ? 429 : 502, { error: message });
      }

      text = data?.choices?.[0]?.message?.content || "";
    } else {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({ contents }),
        },
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data?.error?.message || `Gemini API error (HTTP ${res.status})`;
        console.error("Gemini API error:", message);
        return json(res.status === 429 ? 429 : 502, { error: message });
      }

      text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    }

    if (!text.trim()) {
      return json(502, { error: "AI returned an empty response." });
    }
    return json(200, { text });
  } catch (err) {
    console.error("Function error:", err);
    return json(500, { error: "Failed to reach AI service." });
  }
}

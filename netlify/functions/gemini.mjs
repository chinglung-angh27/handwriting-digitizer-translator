// Netlify Function: secure server-side proxy for the Gemini API.
// The API key lives only in process.env (Netlify env vars) — never in the client bundle.

const MODEL = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

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

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not configured in Netlify environment variables.");
    return json(500, { error: "Server configuration error: API key missing." });
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

  try {
    const res = await fetch(`${API_BASE}/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({ contents: payload.contents }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data?.error?.message || `Gemini API error (HTTP ${res.status})`;
      console.error("Gemini API error:", message);
      return json(res.status === 429 ? 429 : 502, { error: message });
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    if (!text) {
      return json(502, { error: "Gemini returned an empty response." });
    }
    return json(200, { text });
  } catch (err) {
    console.error("Function error:", err);
    return json(500, { error: "Failed to reach Gemini API." });
  }
}

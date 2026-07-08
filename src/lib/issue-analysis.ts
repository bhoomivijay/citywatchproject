import { SEVERITY_AI_PROMPT } from "./severity";

export interface IssueAnalysis {
  summary: string;
  category: string;
  severity: number;
  source: "groq" | "gemini" | "local";
}

export interface AnalyzeIssueOptions {
  groqApiKey?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  allowLocalFallback?: boolean;
}

const CATEGORIES = [
  "Traffic",
  "Power Outage",
  "Water Issue",
  "Public Unrest",
  "Infrastructure",
  "Other",
] as const;

const GEMINI_MODELS = ["gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"];
const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are PulseAI, a city management assistant. Analyze citizen reports and respond with JSON only.

Categories (use exactly one): ${CATEGORIES.map((c) => `'${c}'`).join(", ")}
${SEVERITY_AI_PROMPT}

JSON shape: {"summary":"...","category":"...","severity":3}`;

function parseAnalysisJson(text: string, description: string): Omit<IssueAnalysis, "source"> {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const aiData = JSON.parse(cleaned);

  return {
    summary: String(aiData.summary || description.slice(0, 120)),
    category: CATEGORIES.includes(aiData.category) ? aiData.category : "Other",
    severity: Math.min(5, Math.max(1, Number(aiData.severity) || 3)),
  };
}

export function analyzeIssueLocally(description: string): IssueAnalysis {
  const text = description.toLowerCase().trim();
  let category: (typeof CATEGORIES)[number] = "Other";
  let severity = 2;

  const rules: Array<{ category: (typeof CATEGORIES)[number]; keywords: string[] }> = [
    { category: "Traffic", keywords: ["traffic", "accident", "collision", "pothole", "road", "parking", "signal", "jam"] },
    { category: "Power Outage", keywords: ["power", "electric", "electricity", "outage", "blackout", "streetlight", "street light", "wire"] },
    { category: "Water Issue", keywords: ["water", "leak", "flood", "flooding", "drain", "sewage", "pipe", "overflow"] },
    { category: "Public Unrest", keywords: ["protest", "fight", "crime", "theft", "violence", "disturbance", "unsafe"] },
    { category: "Infrastructure", keywords: ["building", "bridge", "construction", "damage", "broken", "collapse", "tree", "garbage", "trash", "waste"] },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      category = rule.category;
      break;
    }
  }

  if (/\b(fire|explosion|gas leak|medical emergency|life.?threatening)\b/.test(text)) severity = 5;
  else if (/\b(emergency|urgent|critical|danger|injured|blocked road)\b/.test(text)) severity = 4;
  else if (/\b(major|serious|large|widespread|multiple)\b/.test(text)) severity = 3;
  else if (/\b(minor|small|slight)\b/.test(text)) severity = 1;

  return {
    summary: description.length <= 120 ? description : `${description.slice(0, 117).trim()}...`,
    category,
    severity,
    source: "local",
  };
}

async function callGroq(description: string, apiKey?: string): Promise<IssueAnalysis> {
  const useDevProxy = import.meta.env.DEV && Boolean(apiKey);
  const url = useDevProxy
    ? "/api/groq/chat/completions"
    : "https://api.groq.com/openai/v1/chat/completions";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!useDevProxy && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analyze this report: "${description}"` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Invalid Groq response");

  return { ...parseAnalysisJson(content, description), source: "groq" };
}

async function callGeminiModel(
  apiKey: string,
  model: string,
  description: string
): Promise<IssueAnalysis> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nAnalyze: "${description}"` }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const aiResponseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!aiResponseText) throw new Error("Invalid Gemini response");

  return { ...parseAnalysisJson(aiResponseText, description), source: "gemini" };
}

function isRetryableAiError(message: string): boolean {
  return (
    message.includes("429") ||
    message.includes("404") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("NOT_FOUND") ||
    message.includes("quota")
  );
}

export async function analyzeIssue(
  description: string,
  options: AnalyzeIssueOptions = {}
): Promise<IssueAnalysis> {
  const { groqApiKey, geminiApiKey, geminiModel, allowLocalFallback = false } = options;
  const errors: string[] = [];

  const hasGroqKey = groqApiKey && !groqApiKey.includes("your_groq");
  const hasGeminiKey = geminiApiKey && !geminiApiKey.includes("your_gemini");

  if (hasGroqKey) {
    try {
      return await callGroq(description, groqApiKey);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(msg);
      console.warn("Groq failed:", msg);
    }
  }

  if (hasGeminiKey) {
    const models = geminiModel
      ? [geminiModel, ...GEMINI_MODELS.filter((m) => m !== geminiModel)]
      : GEMINI_MODELS;

    for (const model of models) {
      try {
        return await callGeminiModel(geminiApiKey!, model, description);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`[${model}] ${msg}`);
        if (!isRetryableAiError(msg)) break;
      }
    }
  }

  if (allowLocalFallback) {
    console.warn("Cloud AI unavailable, using local fallback:", errors.join(" | "));
    return analyzeIssueLocally(description);
  }

  if (!hasGroqKey && !hasGeminiKey) {
    throw new Error(
      "No AI API key configured. Get a free Groq key at console.groq.com, add VITE_GROQ_API_KEY to .env.local, and restart npm run dev."
    );
  }

  throw new Error(
    `AI services unavailable. Gemini quota is exhausted on your Google project. ` +
      `Get a free Groq API key at https://console.groq.com/keys and add it as VITE_GROQ_API_KEY in .env.local, then restart the dev server. ` +
      `Details: ${errors.slice(-2).join(" | ")}`
  );
}

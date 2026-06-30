import { NextResponse } from "next/server";

// Cette route tourne côté serveur (Vercel Function), donc les appels sortants vers
// les API des fournisseurs IA ne sont JAMAIS soumis aux restrictions CORS du
// navigateur — ces restrictions ne s'appliquent qu'aux requêtes lancées depuis le JS
// d'une page web, pas aux requêtes serveur-à-serveur.

export const runtime = "nodejs";

// Si l'utilisateur ne fournit pas de clé dans l'app, on retombe sur des variables
// d'environnement définies dans les Settings > Environment Variables du projet Vercel.
const ENV_KEYS = {
  claude: "ANTHROPIC_API_KEY",
  mistral: "MISTRAL_API_KEY",
  openai: "OPENAI_API_KEY",
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
  cohere: "COHERE_API_KEY",
  xai: "XAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

function resolveKey(provider, clientKey) {
  if (clientKey) return clientKey;
  const envName = ENV_KEYS[provider];
  return envName ? process.env[envName] || "" : "";
}

async function parseErrorBody(r) {
  try {
    const d = await r.json();
    return d.error?.message || d.message || JSON.stringify(d).slice(0, 300);
  } catch {
    return `HTTP ${r.status}`;
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }

  const {
    provider = "claude",
    apiKey = "",
    customUrl = "",
    customModel = "",
    openrouterModel = "",
    system = "",
    messages = [],
    max_tokens = 600,
  } = body || {};

  const key = resolveKey(provider, apiKey);

  try {
    let content = "";

    switch (provider) {
      case "claude": {
        if (!key) {
          throw new Error(
            "Clé Anthropic absente. Renseignez-la dans l'app, ou ajoutez ANTHROPIC_API_KEY dans Vercel > Settings > Environment Variables puis redéployez."
          );
        }
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-5",
            max_tokens,
            system,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        if (!r.ok) throw new Error(await parseErrorBody(r));
        const d = await r.json();
        content = (d.content || []).map((b) => b.text || "").join("");
        break;
      }

      case "mistral": {
        if (!key) throw new Error("Clé Mistral absente.");
        const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "mistral-large-latest",
            max_tokens,
            messages: [{ role: "system", content: system }, ...messages],
          }),
        });
        if (!r.ok) throw new Error(await parseErrorBody(r));
        const d = await r.json();
        content = d.choices?.[0]?.message?.content || "";
        break;
      }

      case "openai": {
        if (!key) throw new Error("Clé OpenAI absente.");
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "gpt-4o",
            max_tokens,
            messages: [{ role: "system", content: system }, ...messages],
          }),
        });
        if (!r.ok) throw new Error(await parseErrorBody(r));
        const d = await r.json();
        content = d.choices?.[0]?.message?.content || "";
        break;
      }

      case "groq": {
        if (!key) throw new Error("Clé Groq absente.");
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens,
            messages: [{ role: "system", content: system }, ...messages],
          }),
        });
        if (!r.ok) throw new Error(await parseErrorBody(r));
        const d = await r.json();
        content = d.choices?.[0]?.message?.content || "";
        break;
      }

      case "gemini": {
        if (!key) throw new Error("Clé Gemini absente.");
        const userText = messages.map((m) => m.content).join("\n");
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userText }] }],
              systemInstruction: { parts: [{ text: system }] },
              generationConfig: { maxOutputTokens: max_tokens },
            }),
          }
        );
        if (!r.ok) throw new Error(await parseErrorBody(r));
        const d = await r.json();
        content = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
        break;
      }

      case "cohere": {
        if (!key) throw new Error("Clé Cohere absente.");
        const userText = messages.map((m) => m.content).join("\n");
        const r = await fetch("https://api.cohere.com/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: "command-r-plus", message: userText, preamble: system, max_tokens }),
        });
        if (!r.ok) throw new Error(await parseErrorBody(r));
        const d = await r.json();
        content = d.text || "";
        break;
      }

      case "xai": {
        if (!key) throw new Error("Clé xAI absente.");
        const r = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "grok-4",
            max_tokens,
            messages: [{ role: "system", content: system }, ...messages],
          }),
        });
        if (!r.ok) throw new Error(await parseErrorBody(r));
        const d = await r.json();
        content = d.choices?.[0]?.message?.content || "";
        break;
      }

      case "openrouter": {
        if (!key) throw new Error("Clé OpenRouter absente.");
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            "HTTP-Referer": "https://lopj-ia.vercel.app",
            "X-Title": "L'OPJ - Droit Penal Camerounais",
          },
          body: JSON.stringify({
            model: openrouterModel || "anthropic/claude-sonnet-4",
            max_tokens,
            messages: [{ role: "system", content: system }, ...messages],
          }),
        });
        if (!r.ok) throw new Error(await parseErrorBody(r));
        const d = await r.json();
        if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
        content = d.choices?.[0]?.message?.content || "";
        break;
      }

      case "custom": {
        if (!customUrl) throw new Error("URL d'API personnalisée manquante.");
        const r = await fetch(customUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(key ? { Authorization: `Bearer ${key}` } : {}),
          },
          body: JSON.stringify({
            model: customModel || "default",
            max_tokens,
            messages: [{ role: "system", content: system }, ...messages],
          }),
        });
        if (!r.ok) throw new Error(await parseErrorBody(r));
        const d = await r.json();
        content = d.choices?.[0]?.message?.content || d.content?.[0]?.text || d.text || JSON.stringify(d).slice(0, 500);
        break;
      }

      default:
        throw new Error(`Fournisseur inconnu : ${provider}`);
    }

    return NextResponse.json({ content });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue côté serveur." }, { status: 502 });
  }
}

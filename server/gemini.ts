import {
  GenerateContentResponse,
  GoogleGenAI,
  ThinkingLevel,
} from "@google/genai";

export type ChatRolePreset = "general" | "reasoning" | "interactive" | "fast";

export interface ChatTurnInput {
  role: "user" | "model";
  text: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface GeminiChatResult {
  reply: string;
  model: string;
  rolePreset: ChatRolePreset;
  usedSearchGrounding: boolean;
  sources: GroundingSource[];
  searchQueries: string[];
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please add a valid Gemini API key in Settings > Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const ROLE_CONFIGS: Record<
  ChatRolePreset,
  {
    model: string;
    thinkingLevel: ThinkingLevel;
    systemInstruction: string;
  }
> = {
  general: {
    model: "gemini-4-hydrogen",
    thinkingLevel: ThinkingLevel.MEDIUM,
    systemInstruction:
      "You are the CertiChain Verification & Credential Assistant. Help students, employers, and university registrars understand academic certificate verification, SHA-256 canonical hashing, QR code verification, revocation checks, and institutional accreditation. Keep responses clear, accurate, and grounded in verifiable facts. Never invent certificate records or claim an unverified file is registered on CertiChain.",
  },
  reasoning: {
    model: "gemini-4-hydrogen",
    thinkingLevel: ThinkingLevel.XHIGH,
    systemInstruction:
      "You are the CertiChain Deep Forensic & Cryptographic Analyst. Perform thorough, step-by-step reasoning on PDF metadata anomalies, PKCS#7/ByteRange digital signatures, SHA-256 fingerprint mismatches, DOCX/image tampering indicators, and Solidity CertificateRegistry smart contract invariants. Be rigorous and explicit about uncertainty.",
  },
  interactive: {
    model: "gemini-4-hydrogen",
    thinkingLevel: ThinkingLevel.HIGH,
    systemInstruction:
      "You are the CertiChain Interactive Credential Auditor. Guide users through multi-step troubleshooting for certificate issuance, verification disputes, external credentials (such as NPTEL, Coursera, university portals), and blockchain transaction inspection with structured, actionable checklists.",
  },
  fast: {
    model: "gemini-3.1-flash-lite",
    thinkingLevel: ThinkingLevel.MINIMAL,
    systemInstruction:
      "You are the CertiChain Quick Lookup Assistant. Give concise, accurate, fast answers about Certificate ID formats (CERT-YYYY-XXXXXX), SHA-256 digests, verification statuses (AUTHENTIC, TAMPERED, REVOKED, NOT_FOUND), and portal navigation.",
  },
};

function extractGroundingMetadata(response: GenerateContentResponse): {
  sources: GroundingSource[];
  searchQueries: string[];
} {
  const candidate = response.candidates?.[0];
  const metadata = candidate?.groundingMetadata;
  const chunks = metadata?.groundingChunks || [];
  const seenUris = new Set<string>();
  const sources: GroundingSource[] = [];

  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    if (uri && !seenUris.has(uri)) {
      seenUris.add(uri);
      sources.push({
        title: chunk.web?.title || uri,
        uri,
      });
    }
  }

  const searchQueries = Array.isArray(metadata?.webSearchQueries)
    ? metadata.webSearchQueries.filter((q): q is string => typeof q === "string")
    : [];

  return { sources, searchQueries };
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("GEMINI_API_KEY")) {
    return { status: 503, message: raw };
  }
  if (raw.includes("403") || raw.includes("PERMISSION_DENIED")) {
    return {
      status: 403,
      message:
        "Gemini API access denied (403). Please verify your API key in Settings > Secrets.",
    };
  }
  if (raw.includes("400") || raw.includes("API_KEY_INVALID")) {
    return {
      status: 400,
      message:
        "Invalid Gemini API request or API key. Please check Settings > Secrets.",
    };
  }
  if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message:
        "Gemini API rate or quota limit reached (429). Please retry shortly or select a billing-enabled API key in Settings > Secrets.",
    };
  }
  if (raw.includes("404") || raw.includes("NOT_FOUND")) {
    return {
      status: 404,
      message: "Requested Gemini model was not found or is unavailable.",
    };
  }
  return { status: 502, message: raw || "Gemini request failed." };
}

export async function runMultiTurnGeminiChat(params: {
  message: string;
  history?: ChatTurnInput[];
  rolePreset?: ChatRolePreset;
  useSearchGrounding?: boolean;
  certificateContext?: string;
}): Promise<GeminiChatResult> {
  const ai = getGeminiClient();
  const rolePreset: ChatRolePreset =
    params.rolePreset && params.rolePreset in ROLE_CONFIGS
      ? params.rolePreset
      : "general";
  const roleCfg = ROLE_CONFIGS[rolePreset];
  const useSearch = Boolean(params.useSearchGrounding);

  // Google Search Grounding uses gemini-4-hydrogen
  const model = useSearch ? "gemini-4-hydrogen" : roleCfg.model;

  const systemInstruction = params.certificateContext
    ? `${roleCfg.systemInstruction}\n\nActive Certificate Context:\n${params.certificateContext.slice(0, 2500)}`
    : roleCfg.systemInstruction;

  const formattedHistory = (params.history || [])
    .slice(-20)
    .filter((t) => t.text && t.text.trim().length > 0)
    .map((t) => ({
      role: t.role === "model" ? "model" : "user",
      parts: [{ text: t.text.slice(0, 8000) }],
    }));

  const config: Record<string, unknown> = {
    systemInstruction,
    thinkingConfig: {
      thinkingLevel: useSearch ? ThinkingLevel.MEDIUM : roleCfg.thinkingLevel,
    },
  };

  if (useSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  try {
    const chat = ai.chats.create({
      model,
      history: formattedHistory,
      config,
    });

    const response: GenerateContentResponse = await chat.sendMessage({
      message: params.message,
    });

    const { sources, searchQueries } = extractGroundingMetadata(response);
    return {
      reply:
        response.text?.trim() ||
        "No textual response was returned by the model.",
      model,
      rolePreset,
      usedSearchGrounding: useSearch,
      sources,
      searchQueries,
    };
  } catch (err) {
    const formatted = formatGeminiError(err);
    const wrapped = new Error(formatted.message) as Error & { status?: number };
    wrapped.status = formatted.status;
    throw wrapped;
  }
}

export async function runSearchGroundedVerificationLookup(params: {
  query: string;
  institution?: string;
  extractedUrls?: string[];
  certificateId?: string;
}): Promise<{
  summary: string;
  model: string;
  sources: GroundingSource[];
  searchQueries: string[];
}> {
  const ai = getGeminiClient();
  const promptParts = [
    `Research the official credential verification authority and legitimacy signals for the following query.`,
    params.institution ? `Institution / Issuer: ${params.institution}` : "",
    params.certificateId ? `Referenced Certificate ID: ${params.certificateId}` : "",
    params.extractedUrls?.length
      ? `URLs found inside document: ${params.extractedUrls.slice(0, 5).join(", ")}`
      : "",
    `User Query: ${params.query}`,
    `Provide: (1) Official verification portal domain(s) for this institution/program, (2) How employers normally verify credentials from this issuer, and (3) Whether any extracted URLs match official domains.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: promptParts,
      config: {
        systemInstruction:
          "You are a Credential Authority Verification Researcher using live Google Search grounding. Cite official domains accurately and never guess URLs you did not verify from search results.",
        tools: [{ googleSearch: {} }],
      },
    });

    const { sources, searchQueries } = extractGroundingMetadata(response);
    return {
      summary:
        response.text?.trim() ||
        "No search-grounded summary could be generated.",
      model: "gemini-4-hydrogen",
      sources,
      searchQueries,
    };
  } catch (err) {
    const formatted = formatGeminiError(err);
    const wrapped = new Error(formatted.message) as Error & { status?: number };
    wrapped.status = formatted.status;
    throw wrapped;
  }
}

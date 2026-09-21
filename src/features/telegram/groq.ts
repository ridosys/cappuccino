import "server-only";

/**
 * Voice-message transcription via Groq's OpenAI-compatible
 * `/audio/transcriptions` endpoint (`whisper-large-v3`) — same
 * fetch + AbortController + typed-error-class pattern as
 * `src/features/purchases/deepseek.ts`.
 */

const API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";

// Telegram voice messages are small opus/ogg clips; this is well under both
// Telegram's own ~20MB bot-download limit and Groq's 25MB upload limit.
export const MAX_VOICE_FILE_BYTES = 15 * 1024 * 1024;

export type GroqErrorCode = "config" | "too_large" | "api" | "empty";

export class GroqError extends Error {
  code: GroqErrorCode;
  constructor(code: GroqErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export async function transcribeVoice(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqError("config", "GROQ_API_KEY is not set");
  if (fileBuffer.byteLength > MAX_VOICE_FILE_BYTES) {
    throw new GroqError("too_large", "voice message exceeds the upload limit");
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(fileBuffer)], { type: mimeType }),
    fileName,
  );
  form.append("model", MODEL);
  form.append("response_format", "text");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    throw new GroqError(
      "api",
      error instanceof Error ? error.message : "request failed",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GroqError(
      "api",
      `Groq responded ${response.status}${detail ? `: ${detail.slice(0, 500)}` : ""}`,
    );
  }

  const text = (await response.text()).trim();
  if (!text) throw new GroqError("empty", "Groq returned no transcription");
  return text;
}

/**
 * AIProvider — provider-agnostic interface for LLM completions.
 *
 * Supported providers (set AI_PROVIDER in env config):
 *   anthropic          → Anthropic Claude (claude-3-5-sonnet, claude-opus-4, etc.)
 *   openai             → OpenAI GPT-4o, GPT-4 Turbo, o1, etc.
 *   gemini             → Google Gemini 1.5 Pro / 2.0 Flash, etc.
 *   openai-compatible  → Any OpenAI-compatible REST API:
 *                          Groq (LLaMA 3), Together AI, Mistral,
 *                          Azure OpenAI, Ollama (local), Anyscale, etc.
 *
 * Each provider implements this interface so AIAnalyzer is 100% decoupled
 * from the underlying SDK / HTTP client.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A base64-encoded image to include in the request.
 * Only sent when the provider's supportsVision flag is true.
 */
export interface AIImageInput {
  /** Raw base64 image data — no data-URI prefix */
  base64: string;
  /** MIME type of the image */
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  /** Optional human-readable label shown to the model alongside the image */
  label?: string;
}

/** Request shape normalised across all providers. */
export interface AICompletionRequest {
  /** System instruction / persona (kept separate for providers that treat it differently) */
  systemPrompt: string;
  /** The actual user message / question */
  userPrompt: string;
  /** Max tokens in the completion (default: 1024) */
  maxTokens?: number;
  /** Temperature 0–1 (default: 0.2 for deterministic classification) */
  temperature?: number;
  /**
   * Optional images for vision-capable models.
   * Providers check their own supportsVision flag before including these.
   * Non-vision providers silently ignore this field.
   */
  images?: AIImageInput[];
}

/** Response shape normalised across all providers. */
export interface AICompletionResponse {
  /** Raw text returned by the model */
  content: string;
  /** Provider name (e.g. "anthropic") */
  provider: string;
  /** Model identifier used for this completion */
  model: string;
  /** Input tokens consumed (if reported by the provider) */
  inputTokens?: number;
  /** Output tokens consumed (if reported by the provider) */
  outputTokens?: number;
}

/** Configuration passed to ProviderFactory.create(). */
export interface AIProviderConfig {
  /** Provider id: "anthropic" | "openai" | "gemini" | "openai-compatible" */
  provider: string;
  /** API key for the chosen provider */
  apiKey: string;
  /**
   * Model identifier.
   * Omit to use the recommended default for each provider.
   *   anthropic          → claude-3-5-sonnet-20241022
   *   openai             → gpt-4o
   *   gemini             → gemini-1.5-pro
   *   openai-compatible  → depends on the platform (required)
   */
  model?: string;
  /**
   * Base URL for the REST API.
   * Required for "openai-compatible". Optional for "openai" (useful for Azure).
   * Examples:
   *   Groq:       https://api.groq.com/openai/v1
   *   Ollama:     http://localhost:11434/v1
   *   Together:   https://api.together.xyz/v1
   *   Azure:      https://<resource>.openai.azure.com
   */
  baseURL?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AIProvider interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Implement this interface to add a new AI provider.
 * The only contract: given a request, return a completion.
 */
export interface AIProvider {
  /** Human-readable provider label (e.g. "anthropic", "openai", "groq") */
  readonly providerName: string;
  /** Model being used (e.g. "claude-3-5-sonnet-20241022", "gpt-4o") */
  readonly modelName: string;
  /**
   * Whether this provider+model combination supports vision (image inputs).
   * When false, the AIAnalyzer will skip image attachments and add a text note instead.
   *
   * Provider defaults:
   *   Anthropic      → true  (all Claude 3+ models)
   *   OpenAI         → true  for gpt-4o, gpt-4-turbo, o1; false for gpt-3.5-turbo
   *   Gemini         → true  (all Gemini 1.5+ models)
   *   openai-compat  → false (conservative default; set per-model if you know)
   */
  readonly supportsVision: boolean;
  /** Run a chat completion and return normalised response */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}

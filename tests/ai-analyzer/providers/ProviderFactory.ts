/**
 * ProviderFactory — resolves AI_PROVIDER config to the correct AIProvider implementation.
 *
 * Usage:
 *   const provider = ProviderFactory.fromEnv();     // reads process.env
 *   const provider = ProviderFactory.create(config); // explicit config
 *
 * Supported provider values:
 *   "anthropic"         — Anthropic Claude (requires @anthropic-ai/sdk — already installed)
 *   "openai"            — OpenAI GPT-4o / o1 etc.  (requires: npm install openai)
 *   "gemini"            — Google Gemini             (requires: npm install @google/generative-ai)
 *   "openai-compatible" — Any OpenAI-compatible API (requires: npm install openai)
 *                         Set AI_BASE_URL to the endpoint:
 *                           Groq:    https://api.groq.com/openai/v1
 *                           Ollama:  http://localhost:11434/v1
 *                           Together: https://api.together.xyz/v1
 *                           Mistral: https://api.mistral.ai/v1
 *                           Azure:   https://<resource>.openai.azure.com
 *
 * Backwards compatibility:
 *   If AI_PROVIDER / AI_API_KEY are not set but ANTHROPIC_API_KEY is,
 *   the factory silently falls back to the Anthropic provider so existing
 *   setups continue to work without any changes.
 */

import { AIProvider, AIProviderConfig } from './AIProvider';
import { AnthropicProvider, ANTHROPIC_DEFAULT_MODEL } from './AnthropicProvider';
import { OpenAIProvider,   OPENAI_DEFAULT_MODEL }   from './OpenAIProvider';
import { GeminiProvider,   GEMINI_DEFAULT_MODEL }   from './GeminiProvider';
import { logger } from '../../utils/Logger';

/** Well-known OpenAI-compatible provider presets (for logging / diagnostics). */
const KNOWN_COMPATIBLE_PROVIDERS: Record<string, string> = {
  'api.groq.com':         'groq',
  'api.together.xyz':     'together',
  'api.mistral.ai':       'mistral',
  'api.endpoints.anyscale': 'anyscale',
  'localhost:11434':      'ollama',
  'openai.azure.com':     'azure',
};

function inferCompatibleName(baseURL?: string): string {
  if (!baseURL) return 'custom';
  for (const [host, name] of Object.entries(KNOWN_COMPATIBLE_PROVIDERS)) {
    if (baseURL.includes(host)) return name;
  }
  return 'custom';
}

export class ProviderFactory {

  /**
   * Create an AIProvider from explicit configuration.
   */
  static create(config: AIProviderConfig): AIProvider {
    const { provider, apiKey, model, baseURL } = config;

    switch (provider.toLowerCase()) {
      case 'anthropic':
        return new AnthropicProvider(apiKey, model || ANTHROPIC_DEFAULT_MODEL);

      case 'openai':
        return new OpenAIProvider(apiKey, model || OPENAI_DEFAULT_MODEL, baseURL, 'openai');

      case 'gemini':
        return new GeminiProvider(apiKey, model || GEMINI_DEFAULT_MODEL);

      case 'openai-compatible': {
        if (!baseURL) {
          throw new Error(
            '[ProviderFactory] AI_BASE_URL is required when AI_PROVIDER=openai-compatible.\n' +
            '  Examples:\n' +
            '    Groq:    AI_BASE_URL=https://api.groq.com/openai/v1\n' +
            '    Ollama:  AI_BASE_URL=http://localhost:11434/v1\n' +
            '    Together: AI_BASE_URL=https://api.together.xyz/v1',
          );
        }
        const name = inferCompatibleName(baseURL);
        if (!model) {
          throw new Error(
            `[ProviderFactory] AI_MODEL is required for openai-compatible provider "${name}".\n` +
            '  Check your provider\'s documentation for the model identifier to use.',
          );
        }
        // Vision support for known compatible providers:
        //   Groq: llama-3.2-90b-vision-preview supports vision
        //   Ollama: llava, moondream, bakllava, minicpm-v support vision
        //   Others: conservative default = false
        const visionModels = ['vision', 'llava', 'moondream', 'bakllava', 'minicpm'];
        const compatVision = visionModels.some(v => model.toLowerCase().includes(v));
        return new OpenAIProvider(apiKey, model, baseURL, name, compatVision);
      }

      default:
        throw new Error(
          `[ProviderFactory] Unknown AI_PROVIDER: "${provider}".\n` +
          '  Supported values: anthropic | openai | gemini | openai-compatible',
        );
    }
  }

  /**
   * Create an AIProvider by reading from process.env.
   *
   * Env vars read (in priority order):
   *   AI_PROVIDER   — provider id         (default: anthropic)
   *   AI_API_KEY    — API key             (fallback: ANTHROPIC_API_KEY for backwards-compat)
   *   AI_MODEL      — model identifier    (optional, uses provider default)
   *   AI_BASE_URL   — base URL            (required for openai-compatible)
   */
  static fromEnv(): AIProvider {
    const provider = (process.env.AI_PROVIDER ?? 'anthropic').trim().toLowerCase();

    // Backwards-compatible API key resolution
    const apiKey =
      process.env.AI_API_KEY ??
      (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : undefined) ??
      '';

    if (!apiKey) {
      throw new Error(
        `[ProviderFactory] No API key found for provider "${provider}".\n` +
        '  Set AI_API_KEY in your .env file or CI secrets.\n' +
        '  (Legacy: ANTHROPIC_API_KEY is also accepted when AI_PROVIDER=anthropic)',
      );
    }

    const model   = process.env.AI_MODEL?.trim()   || undefined;
    const baseURL = process.env.AI_BASE_URL?.trim() || undefined;

    logger.info(`[ProviderFactory] Creating provider: ${provider}${model ? ` / model: ${model}` : ''}`);

    return this.create({ provider, apiKey, model, baseURL });
  }
}

/**
 * GeminiProvider — wraps @google/generative-ai
 *
 * All Gemini 1.5+ models support vision (image inputs).
 *
 * Supported models (AI_MODEL):
 *   gemini-1.5-pro           (default — 1M context, best for complex analysis)
 *   gemini-1.5-flash         (faster, cheaper, still strong)
 *   gemini-2.0-flash         (latest generation)
 *   gemini-2.0-flash-thinking (reasoning model)
 *
 * Required env:
 *   AI_PROVIDER = gemini
 *   AI_API_KEY  = AIza...   (from https://aistudio.google.com/app/apikey)
 *
 * Required package:  npm install @google/generative-ai
 */

import { AIProvider, AICompletionRequest, AICompletionResponse } from './AIProvider';
import { logger } from '../../utils/Logger';

export const GEMINI_DEFAULT_MODEL = 'gemini-1.5-pro';

export class GeminiProvider implements AIProvider {
  readonly providerName  = 'gemini';
  readonly modelName:    string;
  readonly supportsVision = true;   // All Gemini 1.5+ models support vision

  private readonly apiKey: string;

  constructor(apiKey: string, model?: string) {
    if (!apiKey) {
      throw new Error('[GeminiProvider] API key is required. Set AI_API_KEY in your environment.');
    }
    this.apiKey    = apiKey;
    this.modelName = model || GEMINI_DEFAULT_MODEL;
    logger.info(`[GeminiProvider] Initialised — model: ${this.modelName}`);
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    let GoogleGenerativeAI: any;
    try {
      ({ GoogleGenerativeAI } = await import('@google/generative-ai'));
    } catch {
      throw new Error(
        '[GeminiProvider] The "@google/generative-ai" package is not installed. Run: npm install @google/generative-ai',
      );
    }

    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({
      model:             this.modelName,
      systemInstruction: req.systemPrompt,
      generationConfig:  {
        maxOutputTokens: req.maxTokens  ?? 1024,
        temperature:     req.temperature ?? 0.2,
      },
    });

    // Build multimodal parts: text prompt first, then images
    const parts: any[] = [{ text: req.userPrompt }];

    if (req.images?.length) {
      for (const img of req.images) {
        if (img.label) {
          parts.push({ text: `[Image: ${img.label}]` });
        }
        parts.push({
          inlineData: {
            mimeType: img.mediaType,
            data:     img.base64,
          },
        });
      }
    }

    const result   = await model.generateContent({ contents: [{ role: 'user', parts }] });
    const response = result.response;
    const content  = response.text();

    const usageMeta = response.usageMetadata;
    return {
      content,
      provider:     this.providerName,
      model:        this.modelName,
      inputTokens:  usageMeta?.promptTokenCount,
      outputTokens: usageMeta?.candidatesTokenCount,
    };
  }
}

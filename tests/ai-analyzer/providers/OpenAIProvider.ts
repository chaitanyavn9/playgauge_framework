/**
 * OpenAIProvider — wraps the `openai` npm package.
 *
 * Vision support:
 *   gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4-vision-preview → supportsVision = true
 *   gpt-3.5-turbo, o1-mini, o1-preview                      → supportsVision = false
 *   openai-compatible (Groq, Together, etc.)                 → supportsVision = false by default
 *     (Override by passing supportsVision=true when you know the model supports it)
 *
 * Compatible providers via AI_BASE_URL:
 *   Groq         → https://api.groq.com/openai/v1
 *   Together AI  → https://api.together.xyz/v1
 *   Mistral      → https://api.mistral.ai/v1
 *   Ollama local → http://localhost:11434/v1   (AI_API_KEY=ollama)
 *   Azure OpenAI → https://<resource>.openai.azure.com
 *
 * Required package:  npm install openai
 */

import { AIProvider, AICompletionRequest, AICompletionResponse } from './AIProvider';
import { logger } from '../../utils/Logger';

export const OPENAI_DEFAULT_MODEL = 'gpt-4o';

/** Models known to support vision in OpenAI's API */
const VISION_CAPABLE_MODELS = ['gpt-4o', 'gpt-4-turbo', 'gpt-4-vision', 'gpt-4o-mini'];

function modelSupportsVision(model: string): boolean {
  return VISION_CAPABLE_MODELS.some(m => model.toLowerCase().includes(m));
}

export class OpenAIProvider implements AIProvider {
  readonly providerName:   string;
  readonly modelName:      string;
  readonly supportsVision: boolean;

  private readonly apiKey:  string;
  private readonly baseURL?: string;

  constructor(
    apiKey:          string,
    model?:          string,
    baseURL?:        string,
    providerName     = 'openai',
    supportsVision?: boolean,
  ) {
    if (!apiKey) {
      throw new Error('[OpenAIProvider] API key is required. Set AI_API_KEY in your environment.');
    }
    this.apiKey       = apiKey;
    this.modelName    = model   || OPENAI_DEFAULT_MODEL;
    this.baseURL      = baseURL;
    this.providerName = providerName;

    // Auto-detect vision support unless explicitly overridden
    this.supportsVision = supportsVision ?? (
      providerName === 'openai' ? modelSupportsVision(this.modelName) : false
    );

    logger.info(
      `[OpenAIProvider(${providerName})] Initialised — model: ${this.modelName}` +
      `${baseURL ? ` | baseURL: ${baseURL}` : ''} | vision: ${this.supportsVision}`,
    );
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    let OpenAI: any;
    try {
      ({ default: OpenAI } = await import('openai'));
    } catch {
      throw new Error('[OpenAIProvider] The "openai" package is not installed. Run: npm install openai');
    }

    const client = new OpenAI({ apiKey: this.apiKey, baseURL: this.baseURL });

    // Build user message content — multimodal if vision is supported and images provided
    let userContent: any;
    if (this.supportsVision && req.images?.length) {
      userContent = [
        { type: 'text', text: req.userPrompt },
        ...req.images.map(img => ({
          type:      'image_url',
          image_url: {
            url:    `data:${img.mediaType};base64,${img.base64}`,
            detail: 'high',        // high detail for screenshot analysis
          },
          ...(img.label ? { description: img.label } : {}),
        })),
      ];
    } else {
      userContent = req.userPrompt;
    }

    const response = await client.chat.completions.create({
      model:       this.modelName,
      max_tokens:  req.maxTokens  ?? 1024,
      temperature: req.temperature ?? 0.2,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user',   content: userContent },
      ],
    });

    const content = response.choices?.[0]?.message?.content ?? '';

    return {
      content,
      provider:     this.providerName,
      model:        response.model ?? this.modelName,
      inputTokens:  response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    };
  }
}

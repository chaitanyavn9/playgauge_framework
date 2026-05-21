/**
 * AnthropicProvider — wraps @anthropic-ai/sdk
 *
 * All Claude 3+ models support vision (image inputs).
 *
 * Supported models (AI_MODEL):
 *   claude-3-5-sonnet-20241022   (default — best balance of speed + quality)
 *   claude-3-5-haiku-20241022    (faster, cheaper)
 *   claude-opus-4-6              (most capable)
 *   claude-sonnet-4-6            (latest Sonnet)
 *
 * Required env:
 *   AI_PROVIDER = anthropic
 *   AI_API_KEY  = sk-ant-...
 */

import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AICompletionRequest, AICompletionResponse } from './AIProvider';
import { logger } from '../../utils/Logger';

export const ANTHROPIC_DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

export class AnthropicProvider implements AIProvider {
  readonly providerName  = 'anthropic';
  readonly modelName:    string;
  readonly supportsVision = true;   // All Claude 3+ models support vision

  private readonly client: Anthropic;

  constructor(apiKey: string, model?: string) {
    if (!apiKey) {
      throw new Error('[AnthropicProvider] API key is required. Set AI_API_KEY in your environment.');
    }
    this.client    = new Anthropic({ apiKey });
    this.modelName = model || ANTHROPIC_DEFAULT_MODEL;
    logger.info(`[AnthropicProvider] Initialised — model: ${this.modelName}`);
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    // Build multimodal content: images first, then the text prompt
    const userContent: Anthropic.MessageParam['content'] = [];

    if (req.images?.length) {
      for (const img of req.images) {
        userContent.push({
          type:   'image',
          source: {
            type:       'base64',
            media_type: img.mediaType,
            data:        img.base64,
          },
        } as Anthropic.ImageBlockParam);

        if (img.label) {
          userContent.push({ type: 'text', text: `[Image: ${img.label}]` });
        }
      }
    }

    // Text prompt always last
    userContent.push({ type: 'text', text: req.userPrompt });

    const response = await this.client.messages.create({
      model:      this.modelName,
      max_tokens: req.maxTokens  ?? 1024,
      system:     req.systemPrompt,
      messages:   [{ role: 'user', content: userContent }],
    });

    const content = response.content
      .filter(b => b.type === 'text')
      .map(b  => (b as { type: 'text'; text: string }).text)
      .join('');

    return {
      content,
      provider:     this.providerName,
      model:        this.modelName,
      inputTokens:  response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    };
  }
}

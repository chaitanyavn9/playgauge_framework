/**
 * AI Provider barrel export.
 *
 * Import the factory to get the active provider:
 *   import { ProviderFactory } from './providers';
 *   const provider = ProviderFactory.fromEnv();
 *
 * Or construct a specific provider directly:
 *   import { AnthropicProvider, OpenAIProvider, GeminiProvider } from './providers';
 */

export * from './AIProvider';
export * from './AnthropicProvider';
export * from './OpenAIProvider';
export * from './GeminiProvider';
export * from './ProviderFactory';

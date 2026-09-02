import { getAiConfig } from '../../config/ai.js';
import { GeminiTextGenerator } from './geminiTextGenerator.js';
import { OpenAITextGenerator } from './openaiTextGenerator.js';
import { GroqTextGenerator } from './groqTextGenerator.js';

export function createTextGenerator(config = getAiConfig()) {
  switch (config.provider) {
    case 'gemini':
      return new GeminiTextGenerator({ apiKey: config.apiKey, model: config.model });
    case 'openai':
      return new OpenAITextGenerator({ apiKey: config.apiKey, model: config.model });
    case 'groq':
      return new GroqTextGenerator({ apiKey: config.apiKey, model: config.model });
    default:
      throw new Error(`AI_PROVIDER_INVALID: "${config.provider}"`);
  }
}

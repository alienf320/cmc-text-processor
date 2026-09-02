import { getAiConfig } from '../../config/ai.js';
import { GeminiTextGenerator } from './geminiTextGenerator.js';

export function createTextGenerator(config = getAiConfig()) {
  switch (config.provider) {
    case 'gemini':
      return new GeminiTextGenerator({ apiKey: config.apiKey, model: config.model });
    case 'openai':
    case 'groq':
      throw new Error(`AI_PROVIDER_NOT_IMPLEMENTED: todavía no existe un adaptador para "${config.provider}"`);
    default:
      throw new Error(`AI_PROVIDER_INVALID: "${config.provider}"`);
  }
}

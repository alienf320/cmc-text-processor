import { GeminiTextGenerator } from '../adapters/ai/geminiTextGenerator.js';

// Compatibility facade for the current CLI and API consumers.
const textGenerator = new GeminiTextGenerator();

export function generateWithRetry(systemPrompt, userPrompt, maxRetries = 3) {
  return textGenerator.generate(systemPrompt, userPrompt, maxRetries);
}

export async function buildSystemPrompt(basePrompt, extraPrompt = null) {
  if (extraPrompt) {
    return `${basePrompt}\n\nINSTRUCCIONES ADICIONALES:\n${extraPrompt}`;
  }
  return basePrompt;
}

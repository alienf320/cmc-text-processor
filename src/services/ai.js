import { createTextGenerator } from '../adapters/ai/textGeneratorFactory.js';

// Compatibility facade for the current CLI and API consumers.
const textGenerator = createTextGenerator();

export function generateWithRetry(systemPrompt, userPrompt, maxRetries = 3) {
  return textGenerator.generate(systemPrompt, userPrompt, maxRetries);
}

export async function buildSystemPrompt(basePrompt, extraPrompt = null) {
  if (extraPrompt) {
    return `${basePrompt}\n\nINSTRUCCIONES ADICIONALES:\n${extraPrompt}`;
  }
  return basePrompt;
}

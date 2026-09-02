import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const DEFAULT_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

function isHighDemandError(error) {
  const message = String(error?.message || error);
  return message.includes('high demand') || message.includes('Rate limit');
}

/**
 * Gemini implementation of the TextGenerator port.
 */
export class GeminiTextGenerator {
  constructor({ apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY, model, models } = {}) {
    this.provider = createGoogleGenerativeAI({ apiKey });
    this.models = models || [model, ...DEFAULT_MODELS.filter(candidate => candidate !== model)].filter(Boolean);
  }

  async generate(systemPrompt, userPrompt, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      for (const modelName of this.models) {
        try {
          console.log(`Intento ${attempt + 1}/${maxRetries} con modelo: ${modelName}`);
          const { text } = await generateText({
            model: this.provider(modelName),
            system: systemPrompt,
            prompt: userPrompt,
          });
          return { text, modelName };
        } catch (error) {
          lastError = error;
          if (isHighDemandError(error)) {
            console.log(`Modelo ${modelName} saturado, probando siguiente modelo...`);
            continue;
          }
          throw error;
        }
      }

      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 5000;
        console.log(`Todos los modelos saturados. Esperando ${waitTime / 1000}s antes de reintentar...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError;
  }
}

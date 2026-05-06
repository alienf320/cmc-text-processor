import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

function isHighDemandError(error) {
  return error.message.includes('high demand') || error.message.includes('Rate limit');
}

export async function generateWithRetry(systemPrompt, userPrompt, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const modelName of MODELS) {
      try {
        console.log(`Intento ${attempt + 1}/${maxRetries} con modelo: ${modelName}`);
        const { text } = await generateText({
          model: googleProvider(modelName),
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

export async function buildSystemPrompt(basePrompt, extraPrompt = null) {
  if (extraPrompt) {
    return `${basePrompt}\n\nINSTRUCCIONES ADICIONALES:\n${extraPrompt}`;
  }
  return basePrompt;
}

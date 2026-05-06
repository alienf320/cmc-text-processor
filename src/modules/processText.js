import { PROMPTS, TIPO_LABELS, LANG_LABELS } from '../config/prompts.js';
import { generateWithRetry, buildSystemPrompt } from '../services/ai.js';
import { readFile, writeFile } from '../utils/fileUtils.js';

const OUTPUT_FOLDER = 'Resultados';

export async function processText(promptKey, lang, inputFile, outputFile, extraPrompt = null) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error("No se encontró la API Key. Revisa tu archivo .env");
    }

    const rawText = await readFile(inputFile);
    const systemPrompt = await buildSystemPrompt(PROMPTS[promptKey][lang], extraPrompt);

    console.log(`\nProcesando... (${promptKey} / ${lang})`);

    const { text, modelName } = await generateWithRetry(systemPrompt, rawText);
    console.log(`Procesado exitosamente con: ${modelName}`);

    const fecha = new Date().toISOString().split('T')[0];

    const metadata = `---
Tipo: ${TIPO_LABELS[promptKey][lang]}
Idioma: ${LANG_LABELS[lang]}
Fecha: ${fecha}
Fuente: ${inputFile}${extraPrompt ? `\nExtra: ${extraPrompt}` : ''}
---

`;

    await writeFile(outputFile, metadata + text);
    console.log(`¡Éxito! Archivo "${outputFile}" creado.`);
  } catch (error) {
    console.error('Error detallado:', error.message);
  }
}

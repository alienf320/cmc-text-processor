import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import fs from 'fs/promises';
import 'dotenv/config';
import readline from 'readline';

const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const PROMPTS = {
  video: {
    es: `Eres un experto editor de texto. Toma la transcripción de un video,
ordénala en párrafos y secciones Markdown sin resumir.
Coloca el timestamp a los títulos.`,
    en: `You are an expert text editor. Take a video transcription,
organize it into paragraphs and Markdown sections without summarizing.
Add timestamps to the titles.`
  },
  teologico: {
    es: `Eres un editor de textos teológicos y comentarios bíblicos.

REGLAS:
1. NO resumas el contenido. Mantén todas las palabras y ideas intactas.
2. NO elimines ni quites palabras del texto original.
3. Traduce únicamente si el texto contiene palabras o frases en otro idioma.
4. Añade títulos con '##' solo si el texto cambia claramente de tema o sección. No fuerces títulos innecesarios.
5. Corrige errores ortográficos menores y de puntuación sin alterar el contenido.
6. Asegúrate de que las citas bíblicas sigan el formato (Libro Cap:Ver).`,
    en: `You are a theological text and Bible commentary editor.

RULES:
1. Do NOT summarize the content. Keep all words and ideas intact.
2. Do NOT remove or delete any words from the original text.
3. Translate only if the text contains words or phrases in another language.
4. Add '##' titles only if the text clearly changes topic or section. Do not force unnecessary titles.
5. Fix minor spelling and punctuation errors without altering the content.
6. Ensure Bible citations follow the format (Book Chap:Ver).`
  },
  libro: {
    es: `Eres un editor de textos literarios y extractos de libros.

REGLAS:
1. NO resumas el contenido. Mantén todas las palabras y ideas intactas.
2. NO elimines ni quites palabras del texto original.
3. Traduce únicamente si el texto contiene palabras o frases en otro idioma.
4. Añade títulos con '##' solo si el texto cambia claramente de capítulo o sección. No fuerces títulos innecesarios.
5. Corrige errores de OCR, saltos de párrafo y errores ortográficos sin alterar el contenido.`,
    en: `You are a literary text and book excerpt editor.

RULES:
1. Do NOT summarize the content. Keep all words and ideas intact.
2. Do NOT remove or delete any words from the original text.
3. Translate only if the text contains words or phrases in another language.
4. Add '##' titles only if the text clearly changes chapter or section. Do not force unnecessary titles.
5. Fix OCR errors, paragraph breaks, and spelling errors without altering the content.`
  }
};

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

const INPUT_FOLDER = 'Entradas';
const OUTPUT_FOLDER = 'Resultados';

async function listInputFiles() {
  try {
    await fs.mkdir(INPUT_FOLDER, { recursive: true });
    const files = await fs.readdir(INPUT_FOLDER);
    return files.filter(f => f.endsWith('.txt') || f.endsWith('.md'));
  } catch {
    return [];
  }
}

async function listOutputFiles() {
  try {
    await fs.mkdir(OUTPUT_FOLDER, { recursive: true });
    const files = await fs.readdir(OUTPUT_FOLDER);
    return files.filter(f => f.endsWith('.md'));
  } catch {
    return [];
  }
}

async function mainMenu(rl) {
  console.log('=== yt-transcriber ===\n');
  console.log('1. Procesar texto');
  console.log('2. Analizar / Hacer preguntas sobre un texto\n');

  const option = await askQuestion(rl, 'Selecciona una opción (1-2): ');
  return option;
}

async function procesarTextoFlow(rl) {
  const files = await listInputFiles();
  let inputFile;

  if (files.length > 0) {
    console.log('\nArchivos disponibles en la carpeta Entradas/:');
    files.forEach((f, i) => console.log(`${i + 1}. ${f}`));
    console.log(`${files.length + 1}. Ingresar ruta manualmente\n`);

    const fileOption = await askQuestion(rl, 'Selecciona un archivo (número): ');
    const fileIndex = parseInt(fileOption) - 1;

    if (fileIndex >= 0 && fileIndex < files.length) {
      inputFile = `${INPUT_FOLDER}/${files[fileIndex]}`;
    } else {
      inputFile = await askQuestion(rl, 'Ruta del archivo de entrada: ');
    }
  } else {
    console.log('\nNo hay archivos en la carpada Entradas/.');
    inputFile = await askQuestion(rl, 'Ruta del archivo de entrada: ');
  }

  if (!inputFile) {
    inputFile = 'video.txt';
  }

  console.log('\nSelecciona el tipo de contenido:');
  console.log('1. Transcripción de Video');
  console.log('2. Textos Teológicos / Comentarios Bíblicos');
  console.log('3. Extractos de Libros (Inglés / Español)\n');

  const option = await askQuestion(rl, 'Opción (1-3): ');

  let promptKey;
  switch (option) {
    case '1':
      promptKey = 'video';
      break;
    case '2':
      promptKey = 'teologico';
      break;
    case '3':
      promptKey = 'libro';
      break;
    default:
      console.log('Opción inválida. Usando transcripción de video por defecto.');
      promptKey = 'video';
  }

  console.log('\nSelecciona el idioma:');
  console.log('1. Español');
  console.log('2. English');
  const langOption = await askQuestion(rl, 'Opción (1-2): ');
  let lang;
  switch (langOption) {
    case '1':
      lang = 'es';
      break;
    case '2':
      lang = 'en';
      break;
    default:
      console.log('Opción inválida. Usando español por defecto.');
      lang = 'es';
  }

  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const defaultOutput = `${OUTPUT_FOLDER}/${promptKey}_${lang}_${timestamp}.md`;
  const outputFile = await askQuestion(rl, `Archivo de salida (default: ${defaultOutput}): `) || defaultOutput;

  const extraPrompt = await askQuestion(rl, 'Prompt extra (opcional, Enter para saltar): ');

  await procesarTexto(promptKey, lang, inputFile, outputFile, extraPrompt || null);
}

async function analizarTextoFlow(rl) {
  const files = await listOutputFiles();

  if (files.length === 0) {
    console.log('\nNo hay archivos en la carpeta Resultados/.');
    return;
  }

  console.log('\nArchivos disponibles en la carpeta Resultados/:');
  files.forEach((f, i) => console.log(`${i + 1}. ${f}`));
  console.log(`${files.length + 1}. Ingresar ruta manualmente\n`);

  const fileOption = await askQuestion(rl, 'Selecciona un archivo (número): ');
  const fileIndex = parseInt(fileOption) - 1;

  let inputFile;
  if (fileIndex >= 0 && fileIndex < files.length) {
    inputFile = `${OUTPUT_FOLDER}/${files[fileIndex]}`;
  } else {
    inputFile = await askQuestion(rl, 'Ruta del archivo: ');
  }

  if (!inputFile) {
    console.log('No se seleccionó ningún archivo.');
    return;
  }

  const text = await fs.readFile(inputFile, 'utf-8');
  const textWithoutMetadata = text.replace(/^---[\s\S]*?---\n\n?/, '');

  let qaPairs = [];

  while (true) {
    const question = await askQuestion(rl, '\nTu pregunta (o "salir" para terminar): ');

    if (question.toLowerCase() === 'salir') {
      break;
    }

    if (!question) {
      continue;
    }

    console.log('Procesando pregunta...');

    const systemPrompt = `Eres un asistente experto en análisis de textos. Responde las preguntas del usuario basándote en el texto proporcionado. Sé detallado y preciso en tus respuestas.`;

    const { text: answer, modelName } = await generateWithRetryDirect(systemPrompt, `${textWithoutMetadata}\n\nPregunta del usuario: ${question}`);
    console.log(`Respondido con: ${modelName}`);

    qaPairs.push({ question, answer });

    console.log(`\n${answer}`);

    const continuar = await askQuestion(rl, '\n¿Hacer otra pregunta? (s/n): ');
    if (continuar.toLowerCase() !== 's') {
      break;
    }
  }

  if (qaPairs.length > 0) {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const baseName = inputFile.replace(`${OUTPUT_FOLDER}/`, '').replace('.md', '');
    const outputFile = await askQuestion(rl, `Archivo de salida (default: ${OUTPUT_FOLDER}/qa_${baseName}_${timestamp}.md): `)
      || `${OUTPUT_FOLDER}/qa_${baseName}_${timestamp}.md`;

    const fecha = new Date().toISOString().split('T')[0];
    let content = `---
Tipo: Análisis / Preguntas y Respuestas
Fecha: ${fecha}
Fuente: ${inputFile}
---

# Análisis de: ${baseName}

`;

    qaPairs.forEach((pair, index) => {
      content += `## Pregunta ${index + 1}: ${pair.question}\n\n${pair.answer}\n\n---\n\n`;
    });

    await fs.mkdir(OUTPUT_FOLDER, { recursive: true });
    await fs.writeFile(outputFile, content);
    console.log(`\n¡Éxito! Q&A guardado en "${outputFile}"`);
  }
}

const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

async function generateWithRetry(promptKey, lang, rawText, extraPrompt = null, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const modelName of MODELS) {
      try {
        console.log(`Intento ${attempt + 1}/${maxRetries} con modelo: ${modelName}`);
        const systemPrompt = extraPrompt
          ? `${PROMPTS[promptKey][lang]}\n\nINSTRUCCIONES ADICIONALES:\n${extraPrompt}`
          : PROMPTS[promptKey][lang];
        const { text } = await generateText({
          model: googleProvider(modelName),
          system: systemPrompt,
          prompt: rawText,
        });
        return { text, modelName };
      } catch (error) {
        lastError = error;
        const isHighDemand = error.message.includes('high demand') || error.message.includes('Rate limit');
        if (isHighDemand) {
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

async function generateWithRetryDirect(systemPrompt, userPrompt, maxRetries = 3) {
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
        const isHighDemand = error.message.includes('high demand') || error.message.includes('Rate limit');
        if (isHighDemand) {
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

async function procesarTexto(promptKey, lang, inputFile, outputFile, extraPrompt = null) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error("No se encontró la API Key. Revisa tu archivo .env");
    }

    const rawText = await fs.readFile(inputFile, 'utf-8');
    console.log(`\nProcesando... (${promptKey} / ${lang})`);

    const { text, modelName } = await generateWithRetry(promptKey, lang, rawText, extraPrompt);
    console.log(`Procesado exitosamente con: ${modelName}`);

    const tipoLabels = {
      video: { es: 'Transcripción de Video', en: 'Video Transcription' },
      teologico: { es: 'Texto Teológico', en: 'Theological Text' },
      libro: { es: 'Extracto de Libro', en: 'Book Excerpt' }
    };

    const langLabels = { es: 'Español', en: 'English' };
    const fecha = new Date().toISOString().split('T')[0];

    const metadata = `---
Tipo: ${tipoLabels[promptKey][lang]}
Idioma: ${langLabels[lang]}
Fecha: ${fecha}
Fuente: ${inputFile}${extraPrompt ? `\nExtra: ${extraPrompt}` : ''}
---

`;

    await fs.mkdir(OUTPUT_FOLDER, { recursive: true });
    await fs.writeFile(outputFile, metadata + text);
    console.log(`¡Éxito! Archivo "${outputFile}" creado.`);
  } catch (error) {
    console.error('Error detallado:', error.message);
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const option = await mainMenu(rl);

  if (option === '2') {
    await analizarTextoFlow(rl);
  } else {
    await procesarTextoFlow(rl);
  }

  rl.close();
}

main();

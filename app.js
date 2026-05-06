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
    es: `Eres un editor de textos teológicos. Tu objetivo es convertir transcripciones o notas crudas en un formato de ensayo fluido.

REGLAS DE ORO:
1. NARRATIVA DIRECTA: No uses frases como "El orador dice" o "El autor menciona". Escribe el texto como si el autor lo estuviera redactando directamente.
2. ESTRUCTURA: Solo usa '##' para títulos de temas nuevos y significativos. No crees títulos para cada párrafo.
3. TIMESTAMPS: Pon el tiempo solo al inicio de los títulos '##'. Ejemplo: '## La Gracia Soberana (12:45)'.
4. CITAS BÍBLICAS: Asegúrate de que sigan el formato (Libro Cap:Ver). Si el orador dice "San Mateo", cámbialo a "Mateo".
5. CERO REPETICIÓN: Si el texto parece una repetición exacta de una idea anterior o una muletilla, sintetízalo.
6. VERIFICACIÓN: No inventes referencias. Si se cita mal un versículo, mantén la cita pero asegúrate de que el formato sea correcto.`,
    en: `You are a theological text editor. Your goal is to convert raw transcriptions or notes into a fluid essay format.

GOLDEN RULES:
1. DIRECT NARRATIVE: Do not use phrases like "The speaker says" or "The author mentions". Write the text as if the author were drafting it directly.
2. STRUCTURE: Only use '##' for new and significant topic titles. Do not create titles for every paragraph.
3. TIMESTAMPS: Add timestamps only at the beginning of '##' titles. Example: '## Sovereign Grace (12:45)'.
4. BIBLE CITATIONS: Ensure they follow the format (Book Chap:Ver). Keep English Bible book names (e.g., "Matthew" not "Mateo").
5. ZERO REPETITION: If the text seems like an exact repetition of a previous idea or a filler, synthesize it.
6. VERIFICATION: Do not invent references. If a verse is misquoted, keep the quote but ensure the format is correct.`
  },
  libro: {
    es: `Eres un editor de textos literarios. Corrige errores de OCR, arregla saltos de párrafo y formatea el texto para lectura fluida.

REGLAS:
1. No uses timestamps.
2. Corrige errores ortográficos y de formato.
3. Usa '##' solo para capítulos o secciones principales.
4. No resumas el contenido, solo mejora la estructura y claridad.`,
    en: `You are a literary text editor. Fix OCR errors, repair paragraph breaks, and format text for fluent reading.

RULES:
1. Do not use timestamps.
2. Fix spelling and formatting errors.
3. Keep proper names and biblical references in their original English form.
4. Use '##' only for main chapters or sections.
5. Do not summarize content, only improve structure and clarity.`
  }
};

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

const INPUT_FOLDER = 'Entradas';

async function listInputFiles() {
  try {
    await fs.mkdir(INPUT_FOLDER, { recursive: true });
    const files = await fs.readdir(INPUT_FOLDER);
    return files.filter(f => f.endsWith('.txt') || f.endsWith('.md'));
  } catch {
    return [];
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('=== yt-transcriber ===\n');

  // Seleccionar archivo de entrada
  const files = await listInputFiles();
  let inputFile;

  if (files.length > 0) {
    console.log('Archivos disponibles en la carpeta Entradas/:');
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
    console.log('No hay archivos en la carpeta Entradas/.');
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

  // Selección de idioma
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
  const defaultOutput = `Resultados/${promptKey}_${lang}_${timestamp}.md`;
  const outputFile = await askQuestion(rl, `Archivo de salida (default: ${defaultOutput}): `) || defaultOutput;

  rl.close();

  await procesarTexto(promptKey, lang, inputFile, outputFile);
}

const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

async function generateWithRetry(promptKey, lang, rawText, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const modelName of MODELS) {
      try {
        console.log(`Intento ${attempt + 1}/${maxRetries} con modelo: ${modelName}`);
        const { text } = await generateText({
          model: googleProvider(modelName),
          system: PROMPTS[promptKey][lang],
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

async function procesarTexto(promptKey, lang, inputFile, outputFile) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error("No se encontró la API Key. Revisa tu archivo .env");
    }

    const rawText = await fs.readFile(inputFile, 'utf-8');
    console.log(`\nProcesando... (${promptKey} / ${lang})`);

    const { text, modelName } = await generateWithRetry(promptKey, lang, rawText);
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
Fuente: ${inputFile}
---

`;

    await fs.mkdir('Resultados', { recursive: true });
    await fs.writeFile(outputFile, metadata + text);
    console.log(`¡Éxito! Archivo "${outputFile}" creado.`);
  } catch (error) {
    console.error('Error detallado:', error.message);
  }
}

main();
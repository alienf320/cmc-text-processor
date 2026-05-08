import readline from 'readline';
import 'dotenv/config';
import { listFiles } from './utils/fileUtils.js';
import { processText } from './modules/processText.js';
import { analyzeTextFlow } from './modules/analyzeText.js';

const INPUT_FOLDER = 'Entradas';
const OUTPUT_FOLDER = 'Resultados';

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function mainMenu(rl) {
  console.log('=== yt-transcriber ===\n');
  console.log('1. Procesar texto');
  console.log('2. Analizar / Hacer preguntas sobre un texto\n');

  const option = await askQuestion(rl, 'Selecciona una opción (1-2): ');
  return option;
}

async function selectInputFile(rl) {
  const files = await listFiles(INPUT_FOLDER);
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
    console.log('\nNo hay archivos en la carpeta Entradas/.');
    inputFile = await askQuestion(rl, 'Ruta del archivo de entrada: ');
  }

  return inputFile || 'video.txt';
}

async function selectContentType(rl) {
  console.log('\nSelecciona el tipo de contenido:');
  console.log('1. Transcripción de Video');
  console.log('2. Textos Teológicos / Comentarios Bíblicos');
  console.log('3. Extractos de Libros (Inglés / Español)\n');

  const option = await askQuestion(rl, 'Opción (1-3): ');

  switch (option) {
    case '1': return 'video';
    case '2': return 'teologico';
    case '3': return 'libro';
    default:
      console.log('Opción inválida. Usando transcripción de video por defecto.');
      return 'video';
  }
}

async function selectLanguage(rl) {
  console.log('\nSelecciona el idioma:');
  console.log('1. Español');
  console.log('2. English');

  const langOption = await askQuestion(rl, 'Opción (1-2): ');

  switch (langOption) {
    case '1': return 'es';
    case '2': return 'en';
    default:
      console.log('Opción inválida. Usando español por defecto.');
      return 'es';
  }
}

async function processTextFlow(rl) {
  const inputFile = await selectInputFile(rl);
  const promptKey = await selectContentType(rl);
  const lang = await selectLanguage(rl);

  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const defaultOutput = `${OUTPUT_FOLDER}/${promptKey}_${lang}_${timestamp}.md`;
  let outputFile = await askQuestion(rl, `Archivo de salida (default: ${defaultOutput}): `) || defaultOutput;

  if (!outputFile.endsWith('.md')) {
    outputFile += '.md';
  }

  const fileName = outputFile.replace(/.*[\/\\]/, '');
  outputFile = `${OUTPUT_FOLDER}/${fileName}`;

  const extraPrompt = await askQuestion(rl, 'Prompt extra (opcional, Enter para saltar): ');

  await processText(promptKey, lang, inputFile, outputFile, extraPrompt || null);
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const option = await mainMenu(rl);

  if (option === '2') {
    await analyzeTextFlow(rl);
  } else {
    await processTextFlow(rl);
  }

  rl.close();
}

main().catch(console.error);

import readline from 'readline';
import { unlink } from 'fs/promises';
import 'dotenv/config';
import { listFiles } from './utils/fileUtils.js';
import { processText } from './modules/processText.js';
import { analyzeTextFlow } from './modules/analyzeText.js';
import { downloadTranscript } from './modules/youtube.js';
import { listDriveInputFiles, downloadFromDrive } from './services/drive.js';

const INPUT_FOLDER = 'Entradas';
const OUTPUT_FOLDER = 'Resultados';

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function mainMenu(rl) {
  console.log('=== yt-transcriber ===\n');
  console.log('1. Procesar texto / PDF');
  console.log('2. Analizar / Hacer preguntas sobre un texto o PDF');
  console.log('3. Descargar y procesar transcripción de YouTube\n');

  const option = await askQuestion(rl, 'Selecciona una opción (1-3): ');
  return option;
}

// Selección desde carpeta local
async function selectFromLocalFolder(rl) {
  const files = await listFiles(INPUT_FOLDER);

  if (files.length > 0) {
    console.log('\nArchivos disponibles en Entradas/:');
    files.forEach((f, i) => console.log(`${i + 1}. ${f}`));
    console.log(`${files.length + 1}. Ingresar ruta manualmente\n`);

    const fileOption = await askQuestion(rl, 'Selecciona un archivo (número): ');
    const fileIndex = parseInt(fileOption) - 1;

    if (fileIndex >= 0 && fileIndex < files.length) {
      return { filePath: `${INPUT_FOLDER}/${files[fileIndex]}`, isTemporary: false };
    }
  } else {
    console.log('\nNo hay archivos en la carpeta Entradas/.');
  }

  const filePath = await askQuestion(rl, 'Ruta del archivo de entrada: ');
  return { filePath: filePath || 'video.txt', isTemporary: false };
}

// Selección desde Google Drive (carpeta "Entradas")
async function selectFromDrive(rl) {
  console.log('\nConectando con Google Drive...');
  try {
    const files = await listDriveInputFiles();

    if (files.length === 0) {
      console.log('No hay archivos en la carpeta "Entradas" de Drive. Usando selección local.');
      return selectFromLocalFolder(rl);
    }

    console.log('\nArchivos disponibles en Drive (Entradas/):');
    files.forEach((f, i) => console.log(`${i + 1}. ${f.name}`));
    console.log();

    const fileOption = await askQuestion(rl, 'Selecciona un archivo (número): ');
    const fileIndex = parseInt(fileOption) - 1;

    if (fileIndex < 0 || fileIndex >= files.length) {
      console.log('Opción inválida. Usando selección local.');
      return selectFromLocalFolder(rl);
    }

    const selected = files[fileIndex];
    console.log(`\nDescargando "${selected.name}" desde Drive...`);
    const localPath = await downloadFromDrive(selected.id, selected.name);
    console.log(`✅ Descargado en "${localPath}"`);

    return { filePath: localPath, isTemporary: true };
  } catch (error) {
    console.error(`⚠️  Error al conectar con Drive: ${error.message}`);
    console.log('Cambiando a selección local...');
    return selectFromLocalFolder(rl);
  }
}

// Menú principal de selección de archivo de entrada
async function selectInputFile(rl) {
  console.log('\n¿Desde dónde tomamos el archivo de entrada?');
  console.log('1. Carpeta local  (Entradas/)');
  console.log('2. Google Drive   (carpeta "Entradas")');
  console.log('3. Ingresar ruta manualmente\n');

  const sourceOption = await askQuestion(rl, 'Opción (1-3): ');

  if (sourceOption === '2') {
    return selectFromDrive(rl);
  } else if (sourceOption === '3') {
    const filePath = await askQuestion(rl, 'Ruta del archivo de entrada: ');
    return { filePath: filePath || 'video.txt', isTemporary: false };
  } else {
    return selectFromLocalFolder(rl);
  }
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
  const { filePath: inputFile, isTemporary } = await selectInputFile(rl);
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

  // Borrar el archivo temporal si fue descargado desde Drive
  if (isTemporary) {
    try {
      await unlink(inputFile);
      console.log(`🗑️  Archivo temporal eliminado: "${inputFile}"`);
    } catch { /* ignorar si ya no existe */ }
  }
}

async function processYoutubeFlow(rl) {
  const youtubeUrl = await askQuestion(rl, '\nEnlace del video de YouTube (URL): ');
  
  let inputFile;
  try {
    inputFile = await downloadTranscript(youtubeUrl);
  } catch (error) {
    console.log('Hubo un error al intentar descargar la transcripción. Abortando.');
    return;
  }

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
  } else if (option === '3') {
    await processYoutubeFlow(rl);
  } else {
    await processTextFlow(rl);
  }

  rl.close();
}

main().catch(console.error);

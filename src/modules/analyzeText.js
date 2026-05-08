import { generateWithRetry } from '../services/ai.js';
import { readFile, writeFile, listFiles } from '../utils/fileUtils.js';

const OUTPUT_FOLDER = 'Resultados';
const ANALYSIS_SYSTEM_PROMPT = 'Eres un asistente experto en análisis de textos. Responde las preguntas del usuario basándote en el texto proporcionado. Sé detallado y preciso en tus respuestas.';

function stripMetadata(text) {
  return text.replace(/^---[\s\S]*?---\n\n?/, '');
}

export async function analyzeTextFlow(rl) {
  const files = await listFiles(OUTPUT_FOLDER);

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

  const text = await readFile(inputFile);
  const textWithoutMetadata = stripMetadata(text);

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

    const userPrompt = `${textWithoutMetadata}\n\nPregunta del usuario: ${question}`;
    const { text: answer, modelName } = await generateWithRetry(ANALYSIS_SYSTEM_PROMPT, userPrompt);
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
    const defaultOutput = `${OUTPUT_FOLDER}/qa_${baseName}_${timestamp}.md`;
    let outputFile = await askQuestion(rl, `Archivo de salida (default: ${defaultOutput}): `) || defaultOutput;

    if (!outputFile.endsWith('.md')) {
      outputFile += '.md';
    }

    const fileName = outputFile.replace(/.*[\/\\]/, '');
    outputFile = `${OUTPUT_FOLDER}/${fileName}`;

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

    await writeFile(outputFile, content);
    console.log(`\n¡Éxito! Q&A guardado en "${outputFile}"`);
  }
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

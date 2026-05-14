import { PROMPTS, TIPO_LABELS, LANG_LABELS } from '../config/prompts.js';
import { generateWithRetry, buildSystemPrompt } from '../services/ai.js';
import { readFile, writeFile } from '../utils/fileUtils.js';

const OUTPUT_FOLDER = 'Resultados';

function chunkText(text, maxLength = 20000) {
  if (!text || text.length <= maxLength) return [text];

  text = text.replace(/\r\n/g, '\n');

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    if (start + maxLength >= text.length) {
      chunks.push(text.slice(start));
      break;
    }

    let end = start + maxLength;
    const searchWindow = text.slice(start, end);

    const lastPara = searchWindow.lastIndexOf('\n\n');
    if (lastPara > maxLength * 0.3) {
      end = start + lastPara;
    } else {
      const lastNewline = searchWindow.lastIndexOf('\n');
      if (lastNewline > maxLength * 0.3) {
        end = start + lastNewline;
      } else {
        const lastSpace = searchWindow.lastIndexOf(' ');
        if (lastSpace > maxLength * 0.3) {
          end = start + lastSpace;
        }
      }
    }

    chunks.push(text.slice(start, end));
    start = end;

    while (start < text.length && (text[start] === '\n' || text[start] === ' ' || text[start] === '\r')) {
      start++;
    }
  }

  return chunks;
}

function buildMetadata(promptKey, lang, inputFile, fecha, extraPrompt, partNum, totalChunks) {
  let meta = `---
Tipo: ${TIPO_LABELS[promptKey][lang]}
Idioma: ${LANG_LABELS[lang]}
Fecha: ${fecha}
Fuente: ${inputFile}`;
  if (partNum) meta += `\nParte: ${partNum}/${totalChunks}`;
  if (extraPrompt) meta += `\nExtra: ${extraPrompt}`;
  meta += '\n---\n\n';
  return meta;
}

export async function processText(promptKey, lang, inputFile, outputFile, extraPrompt = null) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error("No se encontró la API Key. Revisa tu archivo .env");
    }

    const rawText = await readFile(inputFile);
    const systemPrompt = await buildSystemPrompt(PROMPTS[promptKey][lang], extraPrompt);

    const chunks = chunkText(rawText);
    const totalChunks = chunks.length;

    const fecha = new Date().toISOString().split('T')[0];

    if (totalChunks === 1) {
      console.log(`\nProcesando... (${promptKey} / ${lang})`);

      const { text, modelName } = await generateWithRetry(systemPrompt, rawText);
      console.log(`Procesado exitosamente con: ${modelName}`);

      const metadata = buildMetadata(promptKey, lang, inputFile, fecha, extraPrompt);
      await writeFile(outputFile, metadata + text);
      console.log(`¡Éxito! Archivo "${outputFile}" creado.`);
    } else {
      console.log(`\nEl archivo es extenso (${rawText.length} caracteres).`);
      console.log(`Dividiendo en ${totalChunks} partes para procesamiento...\n`);

      const baseName = outputFile.replace(/\.md$/i, '');

      for (let i = 0; i < totalChunks; i++) {
        const partNum = i + 1;
        const partOutput = `${baseName}_part${partNum}.md`;

        console.log(`Procesando parte ${partNum} de ${totalChunks}...`);

        const { text, modelName } = await generateWithRetry(systemPrompt, chunks[i]);
        console.log(`Parte ${partNum} procesada con: ${modelName}`);

        const metadata = buildMetadata(promptKey, lang, inputFile, fecha, extraPrompt, partNum, totalChunks);
        await writeFile(partOutput, metadata + text);
        console.log(`Parte ${partNum} guardada: "${partOutput}"`);
      }

      console.log(`\n¡Completado! Se procesaron ${totalChunks} partes.`);
    }
  } catch (error) {
    console.error('Error detallado:', error.message);
  }
}

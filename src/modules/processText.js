import { PROMPTS, TIPO_LABELS, LANG_LABELS } from '../config/prompts.js';
import { generateWithRetry, buildSystemPrompt } from '../services/ai.js';
import { readFile, writeFile } from '../utils/fileUtils.js';
import { uploadToDrive } from '../services/drive.js';

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

function buildContinuationContext(previousText) {
  // Tomar las últimas ~800 palabras del texto anterior como contexto de continuidad
  const words = previousText.trim().split(/\s+/);
  const tail = words.slice(-800).join(' ');
  return `

CONTEXTO DE CONTINUIDAD (MUY IMPORTANTE):
Este texto es la continuación directa de una parte anterior ya procesada y formateada.
El final de esa parte anterior fue:
"...${tail}..."

REGLAS OBLIGATORIAS PARA ESTA PARTE:
1. Continúa con exactamente el mismo estilo y jerarquía de títulos (## y ###) que la parte anterior.
2. NO repitas ni reuses títulos o secciones que ya aparecieron en la parte anterior.
3. NO añadas encabezados de inicio como si este fuera el comienzo del documento.
4. Simplemente continúa el flujo del texto donde la parte anterior lo dejó.`;
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
      await uploadToDrive(outputFile);
    } else {
      console.log(`\nEl archivo es extenso (${rawText.length} caracteres).`);
      console.log(`Dividiendo en ${totalChunks} partes para procesamiento...\n`);

      const baseName = outputFile.replace(/\.md$/i, '');

      let previousOutputText = null;

      for (let i = 0; i < totalChunks; i++) {
        const partNum = i + 1;
        const partOutput = `${baseName}_part${partNum}.md`;

        console.log(`Procesando parte ${partNum} de ${totalChunks}...`);

        // A partir de la parte 2, inyectar contexto de la parte anterior
        let effectiveSystemPrompt = systemPrompt;
        if (previousOutputText) {
          const continuationCtx = buildContinuationContext(previousOutputText);
          effectiveSystemPrompt = systemPrompt + continuationCtx;
        }

        const { text, modelName } = await generateWithRetry(effectiveSystemPrompt, chunks[i]);
        console.log(`Parte ${partNum} procesada con: ${modelName}`);

        const metadata = buildMetadata(promptKey, lang, inputFile, fecha, extraPrompt, partNum, totalChunks);
        await writeFile(partOutput, metadata + text);
        console.log(`Parte ${partNum} guardada: "${partOutput}"`);
        await uploadToDrive(partOutput);

        // Guardar el texto generado para pasarlo como contexto a la siguiente parte
        previousOutputText = text;
      }

      // Mergear todas las partes en el archivo final
      let merged = '';
      for (let i = 0; i < totalChunks; i++) {
        const partPath = `${baseName}_part${i + 1}.md`;
        try {
          merged += (await readFile(partPath)) + '\n\n';
        } catch (e) {
          console.error(`No se pudo leer ${partPath}: ${e.message}`);
        }
      }
      await writeFile(outputFile, merged.trim());
      console.log(`¡Completado! Se procesaron ${totalChunks} partes. Archivo final: "${outputFile}"`);
    }
  } catch (error) {
    console.error('Error detallado:', error.message);
  }
}

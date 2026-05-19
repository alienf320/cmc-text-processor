import { fetchTranscript } from 'youtube-transcript';
import fs from 'fs/promises';
import path from 'path';

const INPUT_FOLDER = 'Entradas';

function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

const LANGUAGES = ['es', 'en', 'pt', 'fr', 'de', 'it'];

export async function downloadTranscript(youtubeUrl) {
  try {
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('URL de YouTube no válida');
    }

    console.log(`\nDescargando transcripción del video ${videoId}...`);

    let transcript = null;
    let lastError = null;

    for (const lang of LANGUAGES) {
      try {
        transcript = await fetchTranscript(videoId, { lang });
        console.log(`Transcripción encontrada en idioma: ${lang}`);
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!transcript) {
      try {
        transcript = await fetchTranscript(videoId);
      } catch (error) {
        throw lastError || error;
      }
    }

    if (!transcript || transcript.length === 0) {
      throw new Error('No se encontraron subtítulos para este video');
    }

    const fullText = transcript.map(t => t.text).join(' ');
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `yt_${videoId}_${timestamp}.txt`;
    const filepath = path.join(INPUT_FOLDER, filename);

    await fs.mkdir(INPUT_FOLDER, { recursive: true });

    await fs.writeFile(filepath, fullText, 'utf-8');

    console.log(`Transcripción guardada en: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error('Error al descargar la transcripción:', error.message);
    throw error;
  }
}

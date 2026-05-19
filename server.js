import express from 'express';
import multer from 'multer';
import cors from 'cors';
import 'dotenv/config';
import { processText } from './src/modules/processText.js';
import { downloadTranscript } from './src/modules/youtube.js';
import { generateWithRetry } from './src/services/ai.js';
import { readFile, writeFile, listFiles } from './src/utils/fileUtils.js';
import { uploadToDrive } from './src/services/drive.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FOLDER = 'Resultados';
const INPUT_FOLDER = 'Entradas';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/process', async (req, res) => {
  try {
    const { text, contentType = 'video', language = 'es', extraPrompt = null, fileName = null } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'El campo "text" es requerido' });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return res.status(500).json({ error: 'API Key de Google no configurada' });
    }

    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const safeName = fileName
      ? fileName.replace(/[^a-zA-Z0-9_-]/g, '_')
      : `${contentType}_${language}_${timestamp}`;
    const outputFile = path.join(OUTPUT_FOLDER, `${safeName}.md`);

    await fs.mkdir(INPUT_FOLDER, { recursive: true });
    const inputFile = path.join(INPUT_FOLDER, `input_${timestamp}.txt`);
    await writeFile(inputFile, text);

    await processText(contentType, language, inputFile, outputFile, extraPrompt);

    const result = await readFile(outputFile);

    await fs.unlink(inputFile).catch(() => {});

    res.json({
      success: true,
      fileName: `${safeName}.md`,
      content: result,
    });
  } catch (error) {
    console.error('Error processing text:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/youtube', async (req, res) => {
  try {
    const { url, contentType = 'video', language = 'es', extraPrompt = null } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'El campo "url" es requerido' });
    }

    await fs.mkdir(INPUT_FOLDER, { recursive: true });
    const inputFile = await downloadTranscript(url);

    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const outputFile = path.join(OUTPUT_FOLDER, `yt_${contentType}_${language}_${timestamp}.md`);

    await processText(contentType, language, inputFile, outputFile, extraPrompt);

    await fs.unlink(inputFile).catch(() => {});

    const result = await readFile(outputFile);

    res.json({
      success: true,
      fileName: path.basename(outputFile),
      content: result,
    });
  } catch (error) {
    console.error('Error processing YouTube:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo' });
    }

    const { contentType = 'video', language = 'es', extraPrompt = null } = req.body;

    const inputFile = req.file.path;
    const outputFileName = req.file.originalname.replace(/\.[^.]+$/, '');
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const outputFile = path.join(OUTPUT_FOLDER, `${outputFileName}_${timestamp}.md`);

    await processText(contentType, language, inputFile, outputFile, extraPrompt);

    await fs.unlink(inputFile).catch(() => {});

    const result = await readFile(outputFile);

    res.json({
      success: true,
      fileName: path.basename(outputFile),
      content: result,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { text, question } = req.body;

    if (!text || !question) {
      return res.status(400).json({ error: 'Los campos "text" y "question" son requeridos' });
    }

    const ANALYSIS_PROMPT = 'Eres un asistente experto en análisis de textos. Responde las preguntas del usuario basándote en el texto proporcionado. Sé detallado y preciso en tus respuestas.';

    const userPrompt = `${text}\n\nPregunta del usuario: ${question}`;
    const { text: answer, modelName } = await generateWithRetry(ANALYSIS_PROMPT, userPrompt);

    res.json({
      success: true,
      answer,
      modelUsed: modelName,
    });
  } catch (error) {
    console.error('Error analyzing text:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/results', async (req, res) => {
  try {
    const files = await listFiles(OUTPUT_FOLDER, ['.md']);
    res.json({ files });
  } catch (error) {
    console.error('Error listing results:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/results/:filename', async (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(OUTPUT_FOLDER, safeName);
    const content = await readFile(filePath);
    res.json({
      success: true,
      fileName: safeName,
      content,
    });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(404).json({ error: 'Archivo no encontrado' });
  }
});

const angularDist = path.join(__dirname, 'electron-angular-test', 'dist', 'electron-angular-test', 'browser');
app.use(express.static(angularDist));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(angularDist, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running on port ${PORT}`);
});

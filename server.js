import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { processText } from './src/modules/processText.js';
import { downloadTranscript } from './src/modules/youtube.js';
import { generateWithRetry } from './src/services/ai.js';
import { readFile, writeFile, listFiles } from './src/utils/fileUtils.js';

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

app.get('/api/drive-test', async (req, res) => {
  try {
    const saBase64 = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
    if (!saBase64) return res.json({ step: 'env_var', ok: false, error: 'GOOGLE_DRIVE_SERVICE_ACCOUNT not set' });

    let keyJson;
    try {
      keyJson = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'));
    } catch (e) {
      return res.json({ step: 'parse_json', ok: false, error: e.message });
    }

    if (!keyJson.client_email) return res.json({ step: 'client_email', ok: false, error: 'Missing client_email' });
    if (!keyJson.private_key) return res.json({ step: 'private_key', ok: false, error: 'Missing private_key' });

    const pkInfo = {
      type: typeof keyJson.private_key,
      length: keyJson.private_key.length,
      startsWith: keyJson.private_key.substring(0, 30),
      endsWith: keyJson.private_key.substring(keyJson.private_key.length - 30),
      includesNewlines: keyJson.private_key.includes('\n'),
      includesLiteralN: keyJson.private_key.includes('\\n'),
    };

    const { google } = await import('googleapis');
    let auth;
    try {
      auth = new google.auth.JWT({
        email: keyJson.client_email,
        key: keyJson.private_key,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
    } catch (e) {
      return res.json({ step: 'create_jwt', ok: false, error: e.message, pkInfo });
    }

    try {
      await auth.authorize();
    } catch (e) {
      return res.json({ step: 'authorize', ok: false, error: e.message, pkInfo });
    }

    const drive = google.drive({ version: 'v3', auth });
    const folderName = process.env.DRIVE_FOLDER_NAME || 'yt-transcriber';
    const saEmail = keyJson.client_email;

    // Search for the folder in all accessible drives
    const searchAll = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, owners, shared, permissions)',
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    // Filter: user's shared folder (not owned by SA)
    const userFolder = searchAll.data.files.find(f =>
      !f.owners?.some(o => o.emailAddress === saEmail)
    );
    const saFolder = searchAll.data.files.find(f =>
      f.owners?.some(o => o.emailAddress === saEmail)
    );

    // Show all accessible folders for debugging
    const allFolders = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, owners, shared)',
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 20,
      orderBy: 'name',
    });

    // Quota info
    const about = await drive.about.get({ fields: 'storageQuota, user' });

    res.json({
      sa_email: saEmail,
      folder_name: folderName,
      user_folder: userFolder ? {
        id: userFolder.id,
        name: userFolder.name,
        shared: userFolder.shared,
        owners: userFolder.owners?.map(o => o.emailAddress),
      } : null,
      sa_owned_folder: saFolder ? {
        id: saFolder.id,
        name: saFolder.name,
        shared: saFolder.shared,
      } : null,
      all_folder_names: allFolders.data.files.map(f => ({
        id: f.id, name: f.name, owner: f.owners?.[0]?.emailAddress,
      })),
      quota: about.data.storageQuota,
      sa_user: about.data.user?.emailAddress,
      tip: userFolder
        ? `✅ Usá DRIVE_FOLDER_ID=${userFolder.id} en Render para evitar la búsqueda`
        : '❌ No se encontró la carpeta compartida desde tu Drive personal. Creala, compartila con el SA como Editor, y reintentá.',
    });
  } catch (e) {
    res.json({ step: 'error', ok: false, error: e.message, stack: e.stack?.substring(0, 500) });
  }
});

app.get('/api/diagnose', async (req, res) => {
  try {
    const videoId = req.query.v || 'SrYVdJTVvgw';
    const clients = [
      { clientName: 'ANDROID', clientVersion: '20.10.38' },
      { clientName: 'ANDROID', clientVersion: '21.05.10' },
      { clientName: 'IOS', clientVersion: '20.10.30' },
      { clientName: 'WEB', clientVersion: '2.20250321.00.00' },
    ];
    const results = [];
    for (const client of clients) {
      try {
        const resp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: { client }, videoId }),
          signal: AbortSignal.timeout(10000),
        });
        const data = await resp.json();
        const status = data?.playabilityStatus?.status;
        const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        const trackCount = Array.isArray(tracks) ? tracks.length : 0;
        const langs = trackCount > 0 ? tracks.map(t => t.languageCode) : [];
        results.push({ client: client.clientName, status, tracks: trackCount, langs });
      } catch (e) {
        results.push({ client: client.clientName, error: e.message });
      }
    }
    res.json({ videoId, results, serverIP: req.ip });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/process', async (req, res) => {
  try {
    const { text, contentType = 'video', language = 'es', extraPrompt = null, fileName = null } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'El campo "text" es requerido' });
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
  if (req.path.startsWith('/api')) return;
  const indexPath = path.join(angularDist, 'index.html');
  res.sendFile(indexPath, err => {
    if (err) res.status(404).json({ error: 'Not found', path: req.path });
  });
});

process.on('uncaughtException', err => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', err => {
  console.error('UNHANDLED REJECTION:', err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running on port ${PORT}`);
});

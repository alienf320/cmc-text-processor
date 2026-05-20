import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

async function authenticateWithSA() {
  const saBase64 = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  if (!saBase64) {
    throw new Error('SERVICE_ACCOUNT_MISSING');
  }

  const keyJson = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'));
  const auth = new google.auth.JWT({
    email: keyJson.client_email,
    key: keyJson.private_key,
    scopes: SCOPES,
  });

  return auth;
}

async function authenticateWithOAuth() {
  const CREDENTIALS_PATH = 'credentials.json';
  const TOKEN_PATH = 'token.json';
  let credentials;

  if (process.env.GOOGLE_OAUTH_CREDENTIALS) {
    credentials = JSON.parse(Buffer.from(process.env.GOOGLE_OAUTH_CREDENTIALS, 'base64').toString('utf-8'));
  } else if (fs.existsSync(CREDENTIALS_PATH)) {
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  } else {
    throw new Error(
      `No se encontró el archivo "${CREDENTIALS_PATH}" ni la variable GOOGLE_OAUTH_CREDENTIALS.\n` +
      `Por favor, descargá las credenciales OAuth2 desde Google Cloud Console\n` +
      `y guardalas en la raíz del proyecto como "credentials.json" o configurá la variable de entorno.\n\n` +
      `Instrucciones:\n` +
      `  1. Ir a https://console.cloud.google.com\n` +
      `  2. Habilitar la Google Drive API\n` +
      `  3. Crear credenciales → OAuth 2.0 Client ID → Desktop App\n` +
      `  4. Descargar el JSON y guardarlo como "credentials.json"\n`
    );
  }

  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  let token;
  if (process.env.GOOGLE_OAUTH_TOKEN) {
    token = JSON.parse(Buffer.from(process.env.GOOGLE_OAUTH_TOKEN, 'base64').toString('utf-8'));
  } else if (fs.existsSync(TOKEN_PATH)) {
    token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  }

  if (token) {
    oAuth2Client.setCredentials(token);
    oAuth2Client.on('tokens', (newTokens) => {
      const updated = { ...token, ...newTokens };
      if (!process.env.GOOGLE_OAUTH_TOKEN || fs.existsSync(TOKEN_PATH)) {
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2));
      } else {
        console.log('⚠️ [OAuth] Token renovado en memoria.');
      }
    });
    return oAuth2Client;
  }

  return await authorizeFirstTime(oAuth2Client);
}

async function authenticate() {
  try {
    return await authenticateWithSA();
  } catch (error) {
    if (error.message === 'SERVICE_ACCOUNT_MISSING') {
      return await authenticateWithOAuth();
    }
    throw error;
  }
}

function authorizeFirstTime(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('\n🔐 Se requiere autorización para subir a Google Drive.');
    console.log('   Abrí el siguiente enlace en tu navegador:\n');
    console.log(`   ${authUrl}\n`);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('   Pegá el código de autorización aquí: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code.trim(), (err, token) => {
        if (err) return reject(new Error(`Error al obtener el token: ${err.message}`));
        oAuth2Client.setCredentials(token);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
        console.log(`\n✅ Token guardado en "${TOKEN_PATH}". No tendrás que hacer esto de nuevo.\n`);
        resolve(oAuth2Client);
      });
    });
  });
}

/**
 * Busca una carpeta por nombre en Drive. Si no existe, la crea.
 * @returns {string} folderId
 */
async function getOrCreateFolder(drive, folderName) {
  // Si el usuario especificó un ID de carpeta, usarlo directamente
  const explicitId = process.env.DRIVE_FOLDER_ID;
  if (explicitId) {
    return explicitId;
  }

  // Buscar en todas partes (My Drive, Shared Drive, compartidos con el SA)
  const res = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, owners)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  // Filtrar: NO queremos carpetas cuyo owner sea el SA (no tienen quota)
  // Queremos carpetas compartidas con el SA por el usuario
  if (res.data.files.length > 0) {
    // Tomar la primera carpeta que NO sea dueño el SA
    const saEmail = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT
      ? JSON.parse(
          Buffer.from(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
        ).client_email
      : null;
    const userFolder = res.data.files.find(
      f => !saEmail || !f.owners?.some(o => o.emailAddress === saEmail)
    );
    if (userFolder) return userFolder.id;
  }

  // Si no se encontró, la creamos (con OAuth tenemos cuota para hacerlo)
  console.log(`Carpeta "${folderName}" no encontrada. Creándola...`);
  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  console.log(`✅ Carpeta creada exitosamente con ID: ${createRes.data.id}`);
  return createRes.data.id;
}

/**
 * Sube (o actualiza si ya existe) un archivo local a la carpeta indicada en Drive.
 * @param {string} localPath  - Ruta local del archivo a subir
 * @param {string} folderId   - ID de la carpeta destino en Drive
 * @returns {string} URL directa al archivo en Drive
 */
async function uploadFileToDrive(drive, localPath, folderId) {
  const fileName = path.basename(localPath);
  const fileStream = fs.createReadStream(localPath);

  // Verificar si ya existe un archivo con ese nombre en la carpeta
  const existingRes = await drive.files.list({
    q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  let fileId;

  if (existingRes.data.files.length > 0) {
    // Actualizar archivo existente
    fileId = existingRes.data.files[0].id;
    await drive.files.update({
      fileId,
      media: {
        mimeType: 'text/markdown',
        body: fileStream,
      },
      supportsAllDrives: true,
    });
  } else {
    // Crear archivo nuevo
    const createRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: 'text/markdown',
        body: fileStream,
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    fileId = createRes.data.id;
  }

  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Función principal exportada: autentica y sube un archivo a la carpeta configurada.
 * @param {string} localFilePath - Ruta local del archivo .md a subir
 */
export async function uploadToDrive(localFilePath) {
  const folderName = process.env.DRIVE_FOLDER_NAME || 'yt-transcriber';

  try {
    const auth = await authenticate();
    const drive = google.drive({ version: 'v3', auth });

    const folderId = await getOrCreateFolder(drive, folderName);
    const fileUrl = await uploadFileToDrive(drive, localFilePath, folderId);

    console.log(`☁️  Subido a Drive: ${fileUrl}`);
    return fileUrl;
  } catch (error) {
    console.error(`⚠️  No se pudo subir a Drive: ${error.message}`);
    // No lanzamos el error para que el proceso principal no se interrumpa
  }
}

/**
 * Lista los archivos disponibles en la carpeta "Entradas" de Drive.
 * @returns {Array<{id: string, name: string}>}
 */
export async function listDriveInputFiles() {
  const folderName = process.env.DRIVE_INPUT_FOLDER || 'Entradas';

  const auth = await authenticate();
  const drive = google.drive({ version: 'v3', auth });

  const folderId = await getOrCreateFolder(drive, folderName);

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and (
      mimeType='text/plain' or
      mimeType='application/pdf' or
      name contains '.md' or
      name contains '.txt'
    )`,
    fields: 'files(id, name)',
    spaces: 'drive',
    orderBy: 'name',
  });

  return res.data.files;
}

/**
 * Descarga un archivo de Drive a la carpeta local Entradas/.
 * @param {string} fileId  - ID del archivo en Drive
 * @param {string} fileName - Nombre del archivo
 * @returns {string} Ruta local del archivo descargado
 */
export async function downloadFromDrive(fileId, fileName) {
  const auth = await authenticate();
  const drive = google.drive({ version: 'v3', auth });

  const localDir = 'Entradas';
  fs.mkdirSync(localDir, { recursive: true });
  const localPath = path.join(localDir, fileName);

  const dest = fs.createWriteStream(localPath);

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    res.data
      .on('error', reject)
      .pipe(dest)
      .on('finish', () => resolve(localPath))
      .on('error', reject);
  });
}

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Rutas de los archivos de credenciales y token (en la raíz del proyecto)
const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';

// Permiso de escritura en Drive del usuario
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/**
 * Carga o genera el token OAuth2.
 * En el primer uso, abre el navegador y pide al usuario que autorice.
 * A partir del segundo uso, lee el token guardado y lo refresca automáticamente.
 */
async function authenticate() {
  // Verificar que exista credentials.json
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `No se encontró el archivo "${CREDENTIALS_PATH}".\n` +
      `Por favor, descargá las credenciales OAuth2 desde Google Cloud Console\n` +
      `y guardalas en la raíz del proyecto como "credentials.json".\n\n` +
      `Instrucciones:\n` +
      `  1. Ir a https://console.cloud.google.com\n` +
      `  2. Habilitar la Google Drive API\n` +
      `  3. Crear credenciales → OAuth 2.0 Client ID → Desktop App\n` +
      `  4. Descargar el JSON y guardarlo como "credentials.json"\n`
    );
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Si ya existe el token, usarlo (y refrescarlo si venció)
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oAuth2Client.setCredentials(token);

    // Refrescar el access_token si está vencido
    oAuth2Client.on('tokens', (newTokens) => {
      const updated = { ...token, ...newTokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2));
    });

    return oAuth2Client;
  }

  // Primera vez: iniciar flujo de autorización
  return await authorizeFirstTime(oAuth2Client);
}

/**
 * Flujo interactivo de autorización OAuth2 (solo se ejecuta la primera vez).
 */
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
  // Buscar si ya existe
  const res = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  // No existe → crearla
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  console.log(`📁 Carpeta "${folderName}" creada en Google Drive.`);
  return folder.data.id;
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

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Check if we are in development mode (passed via environment variable or just try loading localhost)
  const isDev = process.env.NODE_ENV?.trim() === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:4201');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, 'dist/electron-angular-test/browser/index.html'),
        protocol: 'file:',
        slashes: true
      })
    );
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

const fs = require('fs/promises');

// Example IPC handler if we want to send data back and forth
ipcMain.on('file-dropped', (event, filePath) => {
  console.log('File dropped:', filePath);
  // Do something with the file, like reading its contents
});

// Phase 2: Read 'resultados' directory
ipcMain.handle('read-results-dir', async () => {
  try {
    const resultsPath = path.join(__dirname, '..', 'resultados');
    const files = await fs.readdir(resultsPath);
    // Filter only .md files and return full paths with filename
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => ({
        name: file,
        path: path.join(resultsPath, file)
      }));
  } catch (error) {
    console.error('Error reading results dir:', error);
    return [];
  }
});

// Phase 2: Read specific file content
ipcMain.handle('read-file-content', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading file:', filePath, error);
    return `Error reading file: ${error.message}`;
  }
});

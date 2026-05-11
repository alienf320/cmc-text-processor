const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onFileDrop: (filePath) => ipcRenderer.send('file-dropped', filePath),
  readResultsDir: () => ipcRenderer.invoke('read-results-dir'),
  readMdFile: (filePath) => ipcRenderer.invoke('read-file-content', filePath)
});

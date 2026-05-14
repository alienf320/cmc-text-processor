import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function listFiles(directory, extensions = ['.txt', '.md', '.pdf']) {
  try {
    await ensureDir(directory);
    const files = await fs.readdir(directory);
    return files.filter(f => extensions.some(ext => f.endsWith(ext)));
  } catch {
    return [];
  }
}

export async function readFile(filePath) {
  if (filePath.toLowerCase().endsWith('.pdf')) {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }
  return fs.readFile(filePath, 'utf-8');
}

export async function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (dir) {
    await ensureDir(dir);
  }
  return fs.writeFile(filePath, content);
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

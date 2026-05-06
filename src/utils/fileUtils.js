import fs from 'fs/promises';

export async function ensureDir(path) {
  await fs.mkdir(path, { recursive: true });
}

export async function listFiles(directory, extensions = ['.txt', '.md']) {
  try {
    await ensureDir(directory);
    const files = await fs.readdir(directory);
    return files.filter(f => extensions.some(ext => f.endsWith(ext)));
  } catch {
    return [];
  }
}

export async function readFile(filePath) {
  return fs.readFile(filePath, 'utf-8');
}

export async function writeFile(filePath, content) {
  const dir = filePath.split('/').slice(0, -1).join('/');
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

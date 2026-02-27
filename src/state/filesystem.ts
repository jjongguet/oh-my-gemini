import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJsonFile<T>(
  filePath: string,
): Promise<T | null> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw new Error(
      `Failed to read JSON file at ${filePath}: ${(error as Error).message}`,
    );
  }
}

export async function writeJsonFile(
  filePath: string,
  value: unknown,
  spacing = 2,
): Promise<void> {
  await ensureDirectory(path.dirname(filePath));

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(value, null, spacing)}\n`;

  await fs.writeFile(tempPath, payload, 'utf8');
  await fs.rename(tempPath, filePath);
}

export async function appendNdjsonFile(
  filePath: string,
  value: unknown,
): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

export async function readNdjsonFile<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return [];
    }

    throw new Error(
      `Failed to read NDJSON file at ${filePath}: ${(error as Error).message}`,
    );
  }
}

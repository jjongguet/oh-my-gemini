import { promises as fs } from 'node:fs';
import path from 'node:path';

import { atomicWriteFile } from '../lib/atomic-write.js';

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

  const payload = `${JSON.stringify(value, null, spacing)}\n`;
  await atomicWriteFile(filePath, payload);
}

export async function appendNdjsonFile(
  filePath: string,
  value: unknown,
): Promise<void> {
  await ensureDirectory(path.dirname(filePath));

  const handle = await fs.open(filePath, 'a', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function readNdjsonFile<T>(filePath: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return [];
    }

    throw new Error(
      `Failed to read NDJSON file at ${filePath}: ${(error as Error).message}`,
    );
  }

  const results: T[] = [];
  const lines = raw.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    try {
      results.push(JSON.parse(line) as T);
    } catch {
      console.warn(
        `[readNdjsonFile] Skipping malformed line in ${filePath}: ${line.slice(0, 120)}`,
      );
    }
  }

  return results;
}

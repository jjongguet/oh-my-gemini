import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function readTeamContext(cwd: string): Promise<string | null> {
  const contextPath = path.join(cwd, '.gemini', 'GEMINI.md');
  try {
    return await readFile(contextPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Walk up from `cwd` to the filesystem root looking for DESIGN.md.
 * Stops at the git root boundary (.git directory/file present).
 * Returns the absolute path if found, null otherwise.
 * Never throws.
 */
export async function discoverDesignMd(cwd: string): Promise<string | null> {
  try {
    let current = cwd;

    while (true) {
      // Check for DESIGN.md in current directory.
      const designPath = join(current, 'DESIGN.md');
      const found = await fileExists(designPath);
      if (found) {
        return designPath;
      }

      // Check for git root boundary.
      const isGitRoot = await fileExists(join(current, '.git'));

      // Advance to parent.
      const parent = dirname(current);
      const atRoot = parent === current;

      if (isGitRoot || atRoot) {
        // This was the last directory to check.
        return null;
      }

      current = parent;
    }
  } catch {
    return null;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

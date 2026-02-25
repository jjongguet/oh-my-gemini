import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface MarkerConfig {
  start: string;
  end: string;
}

export interface MarkerMergeResult {
  changed: boolean;
  previousContent: string;
  nextContent: string;
  hadMarkerSection: boolean;
}

export interface MergeMarkerFileOptions {
  marker?: MarkerConfig;
  dryRun?: boolean;
  fsImpl?: Pick<typeof fs, 'readFile' | 'writeFile' | 'mkdir'>;
}

export const DEFAULT_MARKER: MarkerConfig = {
  start: '# >>> oh-my-gemini (managed) >>>',
  end: '# <<< oh-my-gemini (managed) <<<',
};

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}

function trimTerminalBlankLines(lines: string[]): string[] {
  let end = lines.length;

  while (end > 0 && lines[end - 1] === '') {
    end -= 1;
  }

  return lines.slice(0, end);
}

function normalizeBlockLines(block: string | string[]): string[] {
  const rawLines = Array.isArray(block) ? block : block.split(/\r?\n/);
  return trimTerminalBlankLines(rawLines);
}

export function buildMarkerBlock(
  block: string | string[],
  marker: MarkerConfig = DEFAULT_MARKER,
): string {
  const contentLines = normalizeBlockLines(block);
  return ensureTrailingNewline([marker.start, ...contentLines, marker.end].join('\n'));
}

function findMarkerBounds(lines: string[], marker: MarkerConfig): { startIndex: number; endIndex: number } | null {
  const startIndex = lines.findIndex((line) => line.trim() === marker.start.trim());
  if (startIndex === -1) {
    return null;
  }

  const endIndex = lines.findIndex(
    (line, index) => index > startIndex && line.trim() === marker.end.trim(),
  );

  if (endIndex === -1) {
    return null;
  }

  return { startIndex, endIndex };
}

export function mergeMarkedBlock(
  originalContent: string,
  block: string | string[],
  marker: MarkerConfig = DEFAULT_MARKER,
): MarkerMergeResult {
  const existing = originalContent.replace(/\r\n/g, '\n');
  const lines = existing.split('\n');
  const blockLines = buildMarkerBlock(block, marker).trimEnd().split('\n');
  const bounds = findMarkerBounds(lines, marker);

  let nextLines: string[];

  if (bounds) {
    nextLines = [
      ...lines.slice(0, bounds.startIndex),
      ...blockLines,
      ...lines.slice(bounds.endIndex + 1),
    ];
  } else {
    const trimmed = trimTerminalBlankLines(lines);
    nextLines = trimmed.length === 0 ? [...blockLines] : [...trimmed, '', ...blockLines];
  }

  const nextContent = ensureTrailingNewline(nextLines.join('\n'));

  return {
    changed: nextContent !== ensureTrailingNewline(existing),
    previousContent: ensureTrailingNewline(existing),
    nextContent,
    hadMarkerSection: Boolean(bounds),
  };
}

export async function mergeMarkedBlockInFile(
  filePath: string,
  block: string | string[],
  options: MergeMarkerFileOptions = {},
): Promise<MarkerMergeResult> {
  const fsImpl = options.fsImpl ?? fs;
  const marker = options.marker ?? DEFAULT_MARKER;

  let current = '';

  try {
    current = await fsImpl.readFile(filePath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      throw new Error(`Failed to read ${filePath}: ${err.message}`);
    }
  }

  const mergeResult = mergeMarkedBlock(current, block, marker);

  if (!options.dryRun && mergeResult.changed) {
    await fsImpl.mkdir(path.dirname(filePath), { recursive: true });
    await fsImpl.writeFile(filePath, mergeResult.nextContent, 'utf8');
  }

  return mergeResult;
}

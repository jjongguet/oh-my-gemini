const ANSI_RESET = '\u001B[0m';

function canUseColor(): boolean {
  if (process.env.NO_COLOR) {
    return false;
  }

  return process.stdout.isTTY !== false;
}

function paint(code: number, text: string): string {
  if (!canUseColor()) {
    return text;
  }

  return `\u001B[${code}m${text}${ANSI_RESET}`;
}

export function bold(text: string): string {
  return paint(1, text);
}

export function dim(text: string): string {
  return paint(2, text);
}

export function green(text: string): string {
  return paint(32, text);
}

export function yellow(text: string): string {
  return paint(33, text);
}

export function red(text: string): string {
  return paint(31, text);
}

export function cyan(text: string): string {
  return paint(36, text);
}

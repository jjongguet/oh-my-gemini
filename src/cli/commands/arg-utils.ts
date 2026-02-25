import type { ParsedCliArgs } from '../types.js';

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const positionals: string[] = [];
  const options = new Map<string, string | boolean>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      break;
    }

    if (!token.startsWith('-')) {
      positionals.push(token);
      continue;
    }

    if (token === '--') {
      for (let tailIndex = index + 1; tailIndex < argv.length; tailIndex += 1) {
        const tailToken = argv[tailIndex];
        if (tailToken !== undefined) {
          positionals.push(tailToken);
        }
      }
      break;
    }

    if (token.startsWith('--no-')) {
      options.set(token.slice(5), false);
      continue;
    }

    if (token.startsWith('--')) {
      const assignmentIndex = token.indexOf('=');
      if (assignmentIndex > -1) {
        const key = token.slice(2, assignmentIndex);
        const value = token.slice(assignmentIndex + 1);
        options.set(key, value);
        continue;
      }

      const key = token.slice(2);
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith('-')) {
        options.set(key, next);
        index += 1;
      } else {
        options.set(key, true);
      }
      continue;
    }

    const shorthands = token.slice(1).split('');
    for (const short of shorthands) {
      options.set(short, true);
    }
  }

  return { positionals, options };
}

export function getStringOption(
  options: Map<string, string | boolean>,
  names: string[],
): string | undefined {
  for (const name of names) {
    const value = options.get(name);
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

export function hasFlag(options: Map<string, string | boolean>, names: string[]): boolean {
  return names.some((name) => {
    const value = options.get(name);
    return value === true;
  });
}

export function readBooleanOption(
  options: Map<string, string | boolean>,
  names: string[],
  defaultValue: boolean,
): boolean {
  for (const name of names) {
    if (!options.has(name)) {
      continue;
    }

    const value = options.get(name);
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
    }
  }

  return defaultValue;
}

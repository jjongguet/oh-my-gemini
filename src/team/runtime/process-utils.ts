import { spawn } from 'node:child_process';

export interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  ignoreNonZero?: boolean;
  /** Milliseconds before the child process is sent SIGKILL. No timeout by default. */
  timeoutMs?: number;
}

export async function runCommand(
  command: string,
  args: string[],
  options: CommandOptions = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(
          new Error(
            `Command timed out after ${options.timeoutMs}ms: ${command} ${args.join(' ')}`,
          ),
        );
      }, options.timeoutMs);
    }

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (!options.ignoreNonZero && code !== 0) {
        reject(
          new Error(
            `Command failed: ${command} ${args.join(' ')} (exit=${code})${
              stderr ? `\n${stderr.trim()}` : ''
            }`,
          ),
        );
        return;
      }

      resolve({
        code,
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
      });
    });
  });
}

export function shellEscape(value: string): string {
  // Strip characters unsafe in tmux send-keys: null bytes terminate C strings at
  // the OS layer; newlines and carriage-returns cause premature command execution.
  const sanitized = value.replace(/[\x00\r\n]/g, '');
  return `'${sanitized.replace(/'/g, `'"'"'`)}'`;
}

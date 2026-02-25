export interface CliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface ParsedCliArgs {
  positionals: string[];
  options: Map<string, string | boolean>;
}

export interface CommandExecutionResult {
  exitCode: number;
}

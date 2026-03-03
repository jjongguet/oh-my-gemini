export interface HookContext {
  teamName: string;
  cwd: string;
  task: string;
  workers: number;
  stateRoot: string;
}

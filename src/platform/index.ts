export {
  PLATFORM,
  isLinux,
  isMacOS,
  isMacOs,
  isPathRoot,
  isUnix,
  isWindows,
  isWSL,
  isWsl,
  type WslDetectionOptions,
} from './os.js';

export {
  isUnixLikeOnWindows,
  quoteShellArg,
  resolveDefaultShell,
  resolveShellAdapter,
  wrapWithLoginShell,
  type ShellAdapter,
  type ShellAdapterKind,
  type ShellResolutionOptions,
} from './shell-adapter.js';

export * from './process-utils.js';

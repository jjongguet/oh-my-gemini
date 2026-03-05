export {
  PLATFORM,
  isLinux,
  isMacOS,
  isPathRoot,
  isUnix,
  isWindows,
  isWSL,
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

export {
  DEFAULT_RUNTIME_ENV_ALLOWLIST,
  GEMINI_ENV_KEYS,
  applyEnvironmentOverrides,
  buildRuntimeEnvironment,
  pickEnvironment,
  resolveGeminiApiEnvironment,
  type BuildRuntimeEnvironmentOptions,
} from './environment.js';

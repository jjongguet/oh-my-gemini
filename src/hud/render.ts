import { bold, cyan, dim, green, red, yellow } from './colors.js';
import type { HudPreset, HudRenderContext } from './types.js';

type ElementRenderer = (context: HudRenderContext) => string | null;

const CONTROL_CHARS_PATTERN = /[\u0000-\u001F\u007F-\u009F]/g;

function sanitizeDynamicText(value: string): string {
  return value.replace(CONTROL_CHARS_PATTERN, '').trim();
}

function renderStatusOverlay(context: HudRenderContext): string {
  const teamName = sanitizeDynamicText(context.team.teamName) || 'unknown-team';
  const phase = sanitizeDynamicText(context.team.phase) || 'unknown';
  const runtimeStatus = sanitizeDynamicText(context.team.runtimeStatus) || 'unknown';

  if (runtimeStatus === 'failed') {
    return red(`status:${teamName} ${phase}/${runtimeStatus}`);
  }

  if (runtimeStatus === 'running' || phase === 'exec' || phase === 'verify') {
    return yellow(`status:${teamName} ${phase}/${runtimeStatus}`);
  }

  return green(`status:${teamName} ${phase}/${runtimeStatus}`);
}

function renderTaskSummary(context: HudRenderContext): string | null {
  const { completed, total } = context.team.tasks;
  if (total === 0) {
    return dim('tasks:0');
  }

  return dim(`tasks:${completed}/${total}`);
}

function renderWorkerSummary(context: HudRenderContext): string | null {
  const { total, running, done, failed } = context.team.workers;
  if (total === 0) {
    return dim('workers:0');
  }

  const details = [`${done}/${total} done`];
  if (running > 0) {
    details.push(`${running} active`);
  }
  if (failed > 0) {
    details.push(`${failed} failed`);
  }

  return dim(`workers:${details.join(',')}`);
}

function renderGitBranch(context: HudRenderContext): string | null {
  if (!context.gitBranch) {
    return null;
  }

  const branch = sanitizeDynamicText(context.gitBranch);
  if (!branch) {
    return null;
  }

  return cyan(branch);
}

function renderGeminiModel(context: HudRenderContext): string | null {
  if (!context.gemini.model) {
    return null;
  }

  const model = sanitizeDynamicText(context.gemini.model);
  if (!model) {
    return null;
  }

  return dim(`model:${model}`);
}

function renderGeminiApiSource(context: HudRenderContext): string {
  return dim(`api:${context.gemini.keySource}`);
}

function renderGeminiQuota(context: HudRenderContext): string | null {
  const quota = context.gemini.quotaPercent;
  const window = context.gemini.windowPercent;

  const segments: string[] = [];
  if (typeof window === 'number') {
    segments.push(`window:${window}%`);
  }
  if (typeof quota === 'number') {
    segments.push(`quota:${quota}%`);
  }

  if (segments.length === 0) {
    return null;
  }

  return dim(segments.join(','));
}

function renderLastUpdate(context: HudRenderContext): string | null {
  const source = context.team.updatedAt ?? context.gemini.updatedAt ?? context.generatedAt;
  const timestamp = Date.parse(source);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) {
    return dim(`updated:${diffSeconds}s`);
  }

  return dim(`updated:${Math.round(diffSeconds / 60)}m`);
}

const MINIMAL_ELEMENTS: readonly ElementRenderer[] = [
  renderStatusOverlay,
  renderTaskSummary,
  renderWorkerSummary,
];

const FOCUSED_ELEMENTS: readonly ElementRenderer[] = [
  renderGitBranch,
  renderStatusOverlay,
  renderTaskSummary,
  renderWorkerSummary,
  renderGeminiModel,
  renderLastUpdate,
];

const FULL_ELEMENTS: readonly ElementRenderer[] = [
  renderGitBranch,
  renderStatusOverlay,
  renderTaskSummary,
  renderWorkerSummary,
  renderGeminiModel,
  renderGeminiApiSource,
  renderGeminiQuota,
  renderLastUpdate,
];

function getPresetElements(preset: HudPreset): readonly ElementRenderer[] {
  switch (preset) {
    case 'minimal':
      return MINIMAL_ELEMENTS;
    case 'full':
      return FULL_ELEMENTS;
    case 'focused':
    default:
      return FOCUSED_ELEMENTS;
  }
}

export function renderHud(context: HudRenderContext, preset: HudPreset): string {
  const elements = getPresetElements(preset)
    .map((renderer) => renderer(context))
    .filter((entry): entry is string => Boolean(entry));

  const versionTag = context.version ? `#${context.version}` : '';
  const label = bold(`[OMG${versionTag}]`);

  if (!context.team.hasState) {
    return `${label} ${dim(`status:${context.team.teamName} no persisted team state`)}`;
  }

  return `${label} ${elements.join(dim(' | '))}`;
}

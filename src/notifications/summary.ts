export interface SessionSummaryInput {
  sessionId?: string;
  status: 'completed' | 'failed' | 'stopped';
  projectName?: string;
  teamName?: string;
  reason?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  tasksCompleted?: number;
  tasksFailed?: number;
  workersTotal?: number;
  workersCompleted?: number;
  notes?: string[];
}

export interface SessionSummary {
  title: string;
  lines: string[];
  text: string;
  metadata: {
    sessionId?: string;
    status: 'completed' | 'failed' | 'stopped';
    durationMs?: number;
    tasksCompleted?: number;
    tasksFailed?: number;
    workersTotal?: number;
    workersCompleted?: number;
  };
}

function formatDuration(durationMs: number | undefined): string | undefined {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) {
    return undefined;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(' ');
}

function buildTitle(input: SessionSummaryInput): string {
  const target = input.projectName ?? input.teamName ?? input.sessionId ?? 'session';

  switch (input.status) {
    case 'completed':
      return `${target} completed`;
    case 'failed':
      return `${target} failed`;
    case 'stopped':
      return `${target} stopped`;
    default:
      return `${target} finished`;
  }
}

export function buildSessionSummary(input: SessionSummaryInput): SessionSummary {
  const lines: string[] = [];
  const title = buildTitle(input);
  lines.push(title);

  if (input.sessionId) {
    lines.push(`session=${input.sessionId}`);
  }

  const duration = formatDuration(input.durationMs);
  if (duration) {
    lines.push(`duration=${duration}`);
  }

  if (input.tasksCompleted !== undefined || input.tasksFailed !== undefined) {
    const completed = input.tasksCompleted ?? 0;
    const failed = input.tasksFailed ?? 0;
    lines.push(`tasks=${completed} completed${failed > 0 ? `, ${failed} failed` : ''}`);
  }

  if (input.workersTotal !== undefined || input.workersCompleted !== undefined) {
    const workersCompleted = input.workersCompleted ?? 0;
    const workersTotal = input.workersTotal ?? workersCompleted;
    lines.push(`workers=${workersCompleted}/${workersTotal}`);
  }

  if (input.reason?.trim()) {
    lines.push(`reason=${input.reason.trim()}`);
  }

  if (Array.isArray(input.notes)) {
    for (const note of input.notes) {
      const normalized = typeof note === 'string' ? note.trim() : '';
      if (normalized) {
        lines.push(`note=${normalized}`);
      }
    }
  }

  return {
    title,
    lines,
    text: lines.join('\n'),
    metadata: {
      sessionId: input.sessionId,
      status: input.status,
      durationMs: input.durationMs,
      tasksCompleted: input.tasksCompleted,
      tasksFailed: input.tasksFailed,
      workersTotal: input.workersTotal,
      workersCompleted: input.workersCompleted,
    },
  };
}

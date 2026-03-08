import { MODE_NAMES, type ModeName } from '../../lib/mode-names.js';

export type KeywordType =
  | 'cancel'
  | 'ralph'
  | 'autopilot'
  | 'team'
  | 'ultrawork'
  | 'learner';

export interface DetectedKeyword {
  type: KeywordType;
  keyword: string;
  mode?: ModeName;
  index: number;
}

export interface ModeRoute {
  mode?: ModeName;
  keywords: DetectedKeyword[];
  workerCount?: number;
  cleanedPrompt: string;
}

const KEYWORD_PRIORITY: readonly KeywordType[] = [
  'cancel',
  'ralph',
  'autopilot',
  'ultrawork',
  'team',
  'learner',
] as const;

const MODE_KEYWORDS: Readonly<Record<Exclude<KeywordType, 'cancel' | 'learner'>, readonly string[]>> = {
  ralph: ['ralph', "don't stop", 'refuse to give up', 'until verified'],
  autopilot: ['autopilot', 'build me', 'ship it', 'end-to-end', 'without user intervention'],
  team: ['team', 'multi-agent', 'multi agent', 'swarm', 'agents'],
  ultrawork: ['ultrawork', 'ultra work', 'ulw', 'burst parallel', 'parallel fixes'],
};

const EXTRA_KEYWORDS: Readonly<Record<'cancel' | 'learner', readonly string[]>> = {
  cancel: ['cancel', 'stop mode', 'abort mode'],
  learner: ['learn this', 'remember this pattern', 'teach yourself'],
};

const KEYWORD_TO_MODE: Partial<Record<KeywordType, ModeName>> = {
  ralph: MODE_NAMES.RALPH,
  autopilot: MODE_NAMES.AUTOPILOT,
  team: MODE_NAMES.TEAM,
  ultrawork: MODE_NAMES.ULTRAWORK,
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function removeCodeBlocks(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ');
}

export function sanitizeForKeywordDetection(input: string): string {
  return removeCodeBlocks(input)
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[A-Za-z]:\\[^\s]+/g, ' ')
    .replace(/\/[\w./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractPromptText(input: string): string {
  return sanitizeForKeywordDetection(input).toLowerCase();
}

export function detectRequestedWorkerCount(input: string): number | undefined {
  const match = input.match(/\b(\d{1,2})\s+(?:agents|workers|threads)\b/i);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export function detectKeywordsWithType(input: string): DetectedKeyword[] {
  const prompt = extractPromptText(input);
  const detections: DetectedKeyword[] = [];

  for (const type of KEYWORD_PRIORITY) {
    const keywords = type in MODE_KEYWORDS
      ? MODE_KEYWORDS[type as keyof typeof MODE_KEYWORDS]
      : EXTRA_KEYWORDS[type as keyof typeof EXTRA_KEYWORDS];

    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${escapeRegExp(keyword.toLowerCase())}\\b`, 'i');
      const match = regex.exec(prompt);
      if (!match || match.index < 0) {
        continue;
      }

      detections.push({
        type,
        keyword,
        mode: KEYWORD_TO_MODE[type],
        index: match.index,
      });
    }
  }

  return detections.sort((left, right) => {
    const priorityDelta = KEYWORD_PRIORITY.indexOf(left.type) - KEYWORD_PRIORITY.indexOf(right.type);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return left.index - right.index;
  });
}

export function routePromptToMode(input: string): ModeRoute {
  const cleanedPrompt = extractPromptText(input);
  const keywords = detectKeywordsWithType(input);

  if (keywords.some((keyword) => keyword.type === 'cancel')) {
    return { cleanedPrompt, keywords };
  }

  const primary = keywords.find((keyword) => keyword.mode !== undefined);
  return {
    cleanedPrompt,
    keywords,
    mode: primary?.mode,
    workerCount: detectRequestedWorkerCount(cleanedPrompt),
  };
}

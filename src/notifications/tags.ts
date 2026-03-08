export type NotificationTagPlatform = 'slack' | 'discord' | 'telegram' | 'webhook';

function normalizeTelegramTag(tag: string): string {
  if (!tag) {
    return tag;
  }

  if (tag.startsWith('#') || tag.startsWith('@') || tag.startsWith('<')) {
    return tag;
  }

  const normalized = tag
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized ? `#${normalized}` : tag;
}

export function normalizeNotificationTags(tags: readonly string[] | undefined): string[] {
  if (!Array.isArray(tags) || tags.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawTag of tags) {
    if (typeof rawTag !== 'string') {
      continue;
    }

    const tag = rawTag.trim();
    if (!tag) {
      continue;
    }

    if (seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    normalized.push(tag);
  }

  return normalized;
}

export function mergeNotificationTags(...tagLists: Array<readonly string[] | undefined>): string[] {
  return normalizeNotificationTags(tagLists.flatMap((tags) => tags ?? []));
}

export function formatNotificationTags(
  tags: readonly string[] | undefined,
  platform: NotificationTagPlatform,
): string {
  const normalized = normalizeNotificationTags(tags);
  if (normalized.length === 0) {
    return '';
  }

  if (platform === 'telegram') {
    return normalized.map((tag) => normalizeTelegramTag(tag)).join(' ');
  }

  return normalized.join(' ');
}

export function prependNotificationTags(
  message: string,
  tags: readonly string[] | undefined,
  platform: NotificationTagPlatform,
): string {
  const body = message.trim();
  const formattedTags = formatNotificationTags(tags, platform);

  if (!formattedTags) {
    return body;
  }

  if (!body) {
    return formattedTags;
  }

  return `${formattedTags}\n${body}`;
}

/**
 * Security utilities for design system content.
 * Sanitizes untrusted DESIGN.md content before injection into agent prompts.
 *
 * Design decisions:
 * - Strip all HTML to prevent tag injection
 * - Escape system instruction tags specifically
 * - Wrap code blocks with untrusted delimiters
 * - Hard truncate at 50000 chars max
 */

import { wrapUntrustedFileContent } from '../agents/prompt-helpers.js';

const MAX_CONTENT_LENGTH = 50_000;

/**
 * Sanitize raw design file content to prevent prompt injection.
 *
 * Steps applied in order:
 * 1. Escape <system-instructions> and <system-reminder> tags (before HTML strip)
 * 2. Strip all remaining HTML tags
 * 3. Wrap triple-backtick code blocks with UNTRUSTED_CODE_BLOCK delimiters
 * 4. Truncate to MAX_CONTENT_LENGTH
 */
export function sanitizeDesignContent(content: string): string {
  // 1. Escape prompt-delimiter tags FIRST (before HTML strip removes them)
  // Matches the 7 tag patterns: 2 system tags + 5 from sanitizePromptContent in prompt-helpers.ts
  let sanitized = content.replace(/<(\/?)system-instructions([^>]*)>/gi, '[$1system-instructions$2]');
  sanitized = sanitized.replace(/<(\/?)system-reminder([^>]*)>/gi, '[$1system-reminder$2]');
  sanitized = sanitized.replace(/<(\/?)(TASK_SUBJECT)[^>]*>/gi, '[$1$2]');
  sanitized = sanitized.replace(/<(\/?)(TASK_DESCRIPTION)[^>]*>/gi, '[$1$2]');
  sanitized = sanitized.replace(/<(\/?)(INBOX_MESSAGE)[^>]*>/gi, '[$1$2]');
  sanitized = sanitized.replace(/<(\/?)(INSTRUCTIONS)[^>]*>/gi, '[$1$2]');
  sanitized = sanitized.replace(/<(\/?)(SYSTEM)[^>]*>/gi, '[$1$2]');

  // 2. Strip all remaining HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // 3. Wrap code blocks (content between triple backticks)
  sanitized = sanitized.replace(
    /```[\s\S]*?```/g,
    (match) => `--- UNTRUSTED_CODE_BLOCK ---\n${match}\n--- END UNTRUSTED_CODE_BLOCK ---`,
  );

  // 4. Truncate to reasonable max length
  if (sanitized.length > MAX_CONTENT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_CONTENT_LENGTH);
  }

  return sanitized;
}

/**
 * Sanitize design content and wrap it with untrusted file delimiters.
 *
 * @param filepath - Original file path, used in the delimiter label
 * @param content - Raw content from the design file
 */
export function wrapDesignSection(filepath: string, content: string): string {
  const sanitized = sanitizeDesignContent(content);
  return wrapUntrustedFileContent(filepath, sanitized);
}

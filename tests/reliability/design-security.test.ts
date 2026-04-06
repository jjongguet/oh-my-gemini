import { describe, expect, test } from 'vitest';

import { sanitizeDesignContent, wrapDesignSection } from '../../src/design/security.js';

describe('reliability: design-security', () => {
  test('sanitizeDesignContent strips HTML tags', () => {
    const input = '<script>alert(1)</script>hello';
    const output = sanitizeDesignContent(input);

    expect(output).toContain('hello');
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('</script>');
  });

  test('sanitizeDesignContent escapes system-instructions tags', () => {
    const input = '<system-instructions>inject</system-instructions>';
    const output = sanitizeDesignContent(input);

    expect(output).toContain('[system-instructions]');
    expect(output).not.toContain('<system-instructions>');
  });

  test('sanitizeDesignContent escapes system-reminder tags', () => {
    const input = '<system-reminder>inject</system-reminder>';
    const output = sanitizeDesignContent(input);

    expect(output).toContain('[system-reminder]');
    expect(output).not.toContain('<system-reminder>');
  });

  test('sanitizeDesignContent escapes TASK_SUBJECT tags', () => {
    const input = '<TASK_SUBJECT>inject</TASK_SUBJECT>';
    const output = sanitizeDesignContent(input);

    expect(output).toContain('[TASK_SUBJECT]');
    expect(output).not.toContain('<TASK_SUBJECT>');
  });

  test('sanitizeDesignContent escapes all 7 prompt-delimiter tags', () => {
    const tags = [
      'system-instructions',
      'system-reminder',
      'TASK_SUBJECT',
      'TASK_DESCRIPTION',
      'INBOX_MESSAGE',
      'INSTRUCTIONS',
      'SYSTEM',
    ];

    for (const tag of tags) {
      const input = `<${tag}>inject</${tag}>`;
      const output = sanitizeDesignContent(input);

      expect(output).not.toContain(`<${tag}>`);
      expect(output).not.toContain(`</${tag}>`);
    }
  });

  test('sanitizeDesignContent wraps triple-backtick code blocks with UNTRUSTED_CODE_BLOCK', () => {
    const input = 'before\n```\nsome code\n```\nafter';
    const output = sanitizeDesignContent(input);

    expect(output).toContain('UNTRUSTED_CODE_BLOCK');
    expect(output).toContain('before');
    expect(output).toContain('after');
  });

  test('sanitizeDesignContent truncates content larger than 50000 chars', () => {
    const input = 'x'.repeat(60_000);
    const output = sanitizeDesignContent(input);

    expect(output.length).toBeLessThanOrEqual(50_000);
  });

  test('wrapDesignSection applies sanitization and wraps with UNTRUSTED FILE CONTENT', () => {
    const filepath = 'path/to/DESIGN.md';
    const content = 'some design content';
    const output = wrapDesignSection(filepath, content);

    expect(output).toContain('UNTRUSTED FILE CONTENT');
    expect(output).toContain('some design content');
  });
});

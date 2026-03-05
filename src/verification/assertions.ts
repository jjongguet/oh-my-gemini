import type { VerifyReport, VerifySuite } from './test-runner.js';

export interface VerificationAssertionResult {
  ok: boolean;
  failures: string[];
}

function createResult(failures: string[]): VerificationAssertionResult {
  return {
    ok: failures.length === 0,
    failures,
  };
}

export function assertExpectedSuites(
  report: VerifyReport,
  expectedSuites: readonly VerifySuite[],
): VerificationAssertionResult {
  const actualSuites = report.suites.map((suiteResult) => suiteResult.suite);
  const failures: string[] = [];

  for (const expectedSuite of expectedSuites) {
    if (!actualSuites.includes(expectedSuite)) {
      failures.push(`Missing expected suite in report: ${expectedSuite}`);
    }
  }

  for (const actualSuite of actualSuites) {
    if (!expectedSuites.includes(actualSuite)) {
      failures.push(`Unexpected suite in report: ${actualSuite}`);
    }
  }

  return createResult(failures);
}

export function assertSuiteCommandPrefix(
  report: VerifyReport,
  expectedPrefix: string,
): VerificationAssertionResult {
  const failures = report.suites
    .filter((suiteResult) => !suiteResult.command.startsWith(expectedPrefix))
    .map((suiteResult) => {
      return `Suite ${suiteResult.suite} command must start with "${expectedPrefix}" (received: "${suiteResult.command}")`;
    });

  return createResult(failures);
}

export function assertNoCommandSubstring(
  report: VerifyReport,
  forbiddenSubstring: string,
): VerificationAssertionResult {
  const failures = report.suites
    .filter((suiteResult) => suiteResult.command.includes(forbiddenSubstring))
    .map((suiteResult) => {
      return `Suite ${suiteResult.suite} command must not include "${forbiddenSubstring}" (received: "${suiteResult.command}")`;
    });

  return createResult(failures);
}

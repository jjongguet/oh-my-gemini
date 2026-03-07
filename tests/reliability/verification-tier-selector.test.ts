import { describe, expect, it } from 'vitest';

import {
  buildChangeMetadata,
  detectArchitecturalChanges,
  detectSecurityImplications,
  getVerificationAgent,
  selectVerificationTier,
  type ChangeMetadata,
} from '../../src/verification/index.js';

describe('reliability: verification tier selector', () => {
  describe('selectVerificationTier', () => {
    it('returns LIGHT for small, fully tested changes', () => {
      const changes: ChangeMetadata = {
        filesChanged: 2,
        linesChanged: 50,
        hasArchitecturalChanges: false,
        hasSecurityImplications: false,
        testCoverage: 'full',
      };

      expect(selectVerificationTier(changes)).toBe('LIGHT');
    });

    it('returns THOROUGH for security-sensitive changes', () => {
      const changes: ChangeMetadata = {
        filesChanged: 1,
        linesChanged: 10,
        hasArchitecturalChanges: false,
        hasSecurityImplications: true,
        testCoverage: 'full',
      };

      expect(selectVerificationTier(changes)).toBe('THOROUGH');
    });

    it('returns THOROUGH for architectural changes', () => {
      const changes: ChangeMetadata = {
        filesChanged: 3,
        linesChanged: 60,
        hasArchitecturalChanges: true,
        hasSecurityImplications: false,
        testCoverage: 'partial',
      };

      expect(selectVerificationTier(changes)).toBe('THOROUGH');
    });

    it('returns THOROUGH for very large file count', () => {
      const changes: ChangeMetadata = {
        filesChanged: 21,
        linesChanged: 100,
        hasArchitecturalChanges: false,
        hasSecurityImplications: false,
        testCoverage: 'full',
      };

      expect(selectVerificationTier(changes)).toBe('THOROUGH');
    });

    it('returns STANDARD for medium changes', () => {
      const changes: ChangeMetadata = {
        filesChanged: 10,
        linesChanged: 200,
        hasArchitecturalChanges: false,
        hasSecurityImplications: false,
        testCoverage: 'partial',
      };

      expect(selectVerificationTier(changes)).toBe('STANDARD');
    });
  });

  describe('getVerificationAgent', () => {
    it('maps LIGHT tier to architect-low profile', () => {
      const agent = getVerificationAgent('LIGHT');
      expect(agent.agent).toBe('architect-low');
      expect(agent.model).toBe('haiku');
    });

    it('maps STANDARD tier to architect-medium profile', () => {
      const agent = getVerificationAgent('STANDARD');
      expect(agent.agent).toBe('architect-medium');
      expect(agent.model).toBe('sonnet');
    });

    it('maps THOROUGH tier to architect profile', () => {
      const agent = getVerificationAgent('THOROUGH');
      expect(agent.agent).toBe('architect');
      expect(agent.model).toBe('opus');
    });
  });

  describe('detectArchitecturalChanges', () => {
    it('detects structural config/schema/types files', () => {
      expect(detectArchitecturalChanges(['src/config.ts'])).toBe(true);
      expect(detectArchitecturalChanges(['db/schema.sql'])).toBe(true);
      expect(detectArchitecturalChanges(['src/types.ts'])).toBe(true);
      expect(detectArchitecturalChanges(['package.json'])).toBe(true);
      expect(detectArchitecturalChanges(['tsconfig.json'])).toBe(true);
    });

    it('does not flag regular source files', () => {
      expect(detectArchitecturalChanges(['src/utils/helper.ts'])).toBe(false);
      expect(detectArchitecturalChanges(['src/components/Button.tsx'])).toBe(false);
    });
  });

  describe('detectSecurityImplications', () => {
    it('detects auth/security/secret related files', () => {
      expect(detectSecurityImplications(['src/auth/login.ts'])).toBe(true);
      expect(detectSecurityImplications(['src/security/encrypt.ts'])).toBe(true);
      expect(detectSecurityImplications(['credentials.json'])).toBe(true);
      expect(detectSecurityImplications(['config/secrets.yaml'])).toBe(true);
      expect(detectSecurityImplications(['.env.local'])).toBe(true);
      expect(detectSecurityImplications(['src/oauth2-client.ts'])).toBe(true);
      expect(detectSecurityImplications(['src/jwt_utils.ts'])).toBe(true);
    });

    it('avoids known false positives', () => {
      expect(detectSecurityImplications(['src/utils/tokenizer.ts'])).toBe(false);
      expect(detectSecurityImplications(['src/admin/secretariat.ts'])).toBe(false);
      expect(detectSecurityImplications(['src/blockchain/permissionless.ts'])).toBe(false);
    });
  });

  describe('buildChangeMetadata', () => {
    it('builds metadata using file detectors', () => {
      const metadata = buildChangeMetadata(['src/auth/login.ts', 'src/config.ts'], 120, 'full');

      expect(metadata.filesChanged).toBe(2);
      expect(metadata.linesChanged).toBe(120);
      expect(metadata.hasArchitecturalChanges).toBe(true);
      expect(metadata.hasSecurityImplications).toBe(true);
      expect(metadata.testCoverage).toBe('full');
    });

    it('defaults testCoverage to partial', () => {
      const metadata = buildChangeMetadata(['src/utils/helper.ts'], 10);
      expect(metadata.testCoverage).toBe('partial');
    });
  });
});

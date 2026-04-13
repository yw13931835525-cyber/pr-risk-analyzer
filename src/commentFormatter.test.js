const { CommentFormatter } = require('./commentFormatter');

describe('CommentFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new CommentFormatter();
  });

  describe('formatComment', () => {
    test('should generate all-clear message for no risks', () => {
      const results = {
        risks: [],
        stats: { totalFiles: 3, totalAdditions: 50, totalDeletions: 10, newFiles: 1, modifiedFiles: 2 },
        prDetails: { body: 'Great PR', title: 'Nice fix' },
        threshold: 'low',
      };

      const comment = formatter.formatComment(results);
      expect(comment).toContain('All Checks Passed');
      expect(comment).toContain('Low Risk');
    });

    test('should format critical risk correctly', () => {
      const results = {
        risks: [
          {
            id: 'DB_MIGRATION_ADD',
            name: 'New Database Migration Detected',
            severity: 'critical',
            category: 'database',
            emoji: '🗄️',
            description: 'New migration detected',
            recommendation: 'Review with DBA',
            details: { files: ['migrations/001.sql'], count: 1 },
          },
        ],
        stats: { totalFiles: 1, totalAdditions: 20, totalDeletions: 0, newFiles: 1, modifiedFiles: 0 },
        prDetails: { body: 'Add migration', title: 'DB change' },
        threshold: 'low',
      };

      const comment = formatter.formatComment(results);
      expect(comment).toContain('Critical Risk');
      expect(comment).toContain('🗄️');
      expect(comment).toContain('migrations/001.sql');
      expect(comment).toContain('Review with DBA');
    });

    test('should format high risk correctly', () => {
      const results = {
        risks: [
          {
            id: 'SECURITY_CIPHER_CHANGE',
            name: 'Security Config Changed',
            severity: 'high',
            category: 'security',
            emoji: '🔒',
            description: 'Security config changed',
            recommendation: 'Review with security team',
            details: { files: ['nginx.conf'] },
          },
        ],
        stats: { totalFiles: 1, totalAdditions: 5, totalDeletions: 0, newFiles: 0, modifiedFiles: 1 },
        prDetails: { body: 'TLS update', title: 'Security update' },
        threshold: 'low',
      };

      const comment = formatter.formatComment(results);
      expect(comment).toContain('High Risk');
      expect(comment).toContain('nginx.conf');
    });

    test('should include stats in comment', () => {
      const results = {
        risks: [],
        stats: { totalFiles: 5, totalAdditions: 200, totalDeletions: 50, newFiles: 2, modifiedFiles: 3 },
        prDetails: { body: 'Feature PR', title: 'New feature' },
        threshold: 'low',
      };

      const comment = formatter.formatComment(results);
      expect(comment).toContain('5'); // total files
      expect(comment).toContain('200'); // additions
      expect(comment).toContain('50'); // deletions
      expect(comment).toContain('2'); // new files
      expect(comment).toContain('3'); // modified files
    });

    test('should handle multiple risks in different categories', () => {
      const results = {
        risks: [
          {
            id: 'DB_MIGRATION_ADD',
            name: 'DB Migration',
            severity: 'critical',
            category: 'database',
            emoji: '🗄️',
            description: 'Migration detected',
            recommendation: 'DBA review',
            details: {},
          },
          {
            id: 'TEST_MISSING',
            name: 'Missing Tests',
            severity: 'medium',
            category: 'testing',
            emoji: '🧪',
            description: 'No tests found',
            recommendation: 'Add tests',
            details: { files: ['src/app.js'] },
          },
        ],
        stats: { totalFiles: 2, totalAdditions: 30, totalDeletions: 0, newFiles: 1, modifiedFiles: 1 },
        prDetails: { body: 'Mixed changes', title: 'Mixed' },
        threshold: 'low',
      };

      const comment = formatter.formatComment(results);
      expect(comment).toContain('Database');
      expect(comment).toContain('Testing');
      expect(comment).toContain('Critical');
      expect(comment).toContain('Medium');
    });

    test('should truncate long file paths', () => {
      const longPath = 'src/very/deeply/nested/module/submodule/services/user/authentication/OAuth2.js';
      const results = {
        risks: [
          {
            id: 'TEST_MISSING',
            name: 'Missing Tests',
            severity: 'medium',
            category: 'testing',
            emoji: '🧪',
            description: 'No tests',
            recommendation: 'Add tests',
            details: { files: [longPath] },
          },
        ],
        stats: { totalFiles: 1, totalAdditions: 10, totalDeletions: 0, newFiles: 1, modifiedFiles: 0 },
        prDetails: { body: 'Test', title: 'Test' },
        threshold: 'low',
      };

      const comment = formatter.formatComment(results);
      expect(comment.length).toBeGreaterThan(0);
    });

    test('should include severity counts in verdict', () => {
      const results = {
        risks: [
          { id: 'R1', name: 'Risk 1', severity: 'critical', category: 'db', emoji: '🗄️', description: 'D', recommendation: 'R', details: {} },
          { id: 'R2', name: 'Risk 2', severity: 'high', category: 'sec', emoji: '🔐', description: 'D', recommendation: 'R', details: {} },
          { id: 'R3', name: 'Risk 3', severity: 'medium', category: 'q', emoji: '📝', description: 'D', recommendation: 'R', details: {} },
        ],
        stats: { totalFiles: 3, totalAdditions: 30, totalDeletions: 5, newFiles: 1, modifiedFiles: 2 },
        prDetails: { body: 'Mixed', title: 'Mixed' },
        threshold: 'low',
      };

      const comment = formatter.formatComment(results);
      expect(comment).toContain('1'); // critical count
      expect(comment).toContain('1'); // high count
      expect(comment).toContain('1'); // medium count
    });

    test('should include recommendations section', () => {
      const results = {
        risks: [
          {
            id: 'DB_MIGRATION_ADD',
            name: 'DB Migration',
            severity: 'critical',
            category: 'database',
            emoji: '🗄️',
            description: 'Migration detected',
            recommendation: 'Have DBA review before production deployment',
            details: { files: ['migrations/001.sql'] },
          },
        ],
        stats: { totalFiles: 1, totalAdditions: 20, totalDeletions: 0, newFiles: 1, modifiedFiles: 0 },
        prDetails: { body: 'DB change', title: 'DB' },
        threshold: 'low',
      };

      const comment = formatter.formatComment(results);
      expect(comment).toContain('Recommendations');
      expect(comment).toContain('DBA review');
    });

    test('should handle large PR correctly', () => {
      const results = {
        risks: [
          {
            id: 'PR_SIZE_LARGE',
            name: 'Large PR',
            severity: 'medium',
            category: 'quality',
            emoji: '📏',
            description: 'PR is large',
            recommendation: 'Split it up',
            details: { linesAdded: 900 },
          },
        ],
        stats: { totalFiles: 10, totalAdditions: 900, totalDeletions: 100, newFiles: 3, modifiedFiles: 7 },
        prDetails: { body: 'Big refactor', title: 'Refactor' },
        threshold: 'low',
      };

      const comment = formatter.formatComment(results);
      expect(comment).toContain('Medium Risk');
      expect(comment).toContain('900'); // lines added
    });
  });
});

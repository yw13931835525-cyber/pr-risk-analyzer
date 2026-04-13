const { DiffAnalyzer } = require('./diffAnalyzer');

describe('DiffAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new DiffAnalyzer();
  });

  // Helper: build a minimal unified diff header for a file
  const diffHeader = (filename, status = 'modified') =>
    `diff --git a/${filename} b/${filename}\nindex 1234567..abcdefg 100644\n--- a/${filename}\n+++ b/${filename}`;

  describe('analyze', () => {
    test('should return empty array for clean PR with small changes (with tests)', () => {
      const files = [
        { filename: 'src/index.js', status: 'modified', additions: 5, deletions: 2 },
        { filename: 'src/index.test.js', status: 'modified', additions: 10, deletions: 0 },
      ];
      const prDetails = { body: 'This PR adds a new feature to the application', title: 'Add feature' };
      const diffContent = '';

      const risks = analyzer.analyze(files, prDetails, diffContent);
      // Should have no critical/high risks — TEST_MISSING is not triggered because test file exists
      const criticalOrHigh = risks.filter(r => ['critical', 'high'].includes(r.severity));
      expect(criticalOrHigh.length).toBe(0);
    });

    test('should detect large PR (medium risk)', () => {
      const files = [
        { filename: 'src/app.js', status: 'modified', additions: 900, deletions: 100 }
      ];
      const prDetails = { body: 'Big refactor', title: 'Refactor' };
      const diffContent = '';

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const largePRRisk = risks.find(r => r.id === 'PR_SIZE_LARGE');
      expect(largePRRisk).toBeTruthy();
      expect(largePRRisk.severity).toBe('medium');
    });

    test('should detect very large PR (high risk)', () => {
      const files = [
        { filename: 'src/app.js', status: 'modified', additions: 2000, deletions: 500 }
      ];
      const prDetails = { body: 'Huge change', title: 'Big refactor' };
      const diffContent = '';

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const xlPRRisk = risks.find(r => r.id === 'PR_SIZE_XLARGE');
      expect(xlPRRisk).toBeTruthy();
      expect(xlPRRisk.severity).toBe('high');
    });

    test('should detect missing PR description', () => {
      const files = [{ filename: 'src/app.js', status: 'modified', additions: 10, deletions: 2 }];
      const prDetails = { body: '', title: 'Fix bug' };
      const diffContent = '';

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const noDescRisk = risks.find(r => r.id === 'PR_NO_DESCRIPTION');
      expect(noDescRisk).toBeTruthy();
    });

    test('should NOT flag missing description if description is provided', () => {
      const files = [{ filename: 'src/app.js', status: 'modified', additions: 10, deletions: 2 }];
      const prDetails = { body: 'This PR fixes the login bug by adding proper session handling', title: 'Fix login' };
      const diffContent = '';

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const noDescRisk = risks.find(r => r.id === 'PR_NO_DESCRIPTION');
      expect(noDescRisk).toBeFalsy();
    });

    test('should detect new SQL database migration file', () => {
      const files = [
        { filename: 'migrations/20240101_add_users.sql', status: 'added', additions: 50, deletions: 0 }
      ];
      const prDetails = { body: 'Add users table', title: 'Add users table' };
      const diffContent = diffHeader('migrations/20240101_add_users.sql', 'added');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const migrationRisk = risks.find(r => r.id === 'DB_MIGRATION_ADD');
      expect(migrationRisk).toBeTruthy();
      expect(migrationRisk.severity).toBe('critical');
    });

    test('should detect alembic migration', () => {
      const files = [
        { filename: 'alembic/versions/2024_01_01_add_orders.py', status: 'added', additions: 40, deletions: 0 }
      ];
      const prDetails = { body: 'Alembic migration', title: 'Alembic' };
      const diffContent = diffHeader('alembic/versions/2024_01_01_add_orders.py', 'added');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const migrationRisk = risks.find(r => r.id === 'DB_MIGRATION_ADD');
      expect(migrationRisk).toBeTruthy();
    });

    test('should detect Docker configuration changes', () => {
      const files = [
        { filename: 'Dockerfile', status: 'modified', additions: 10, deletions: 2 }
      ];
      const prDetails = { body: 'Update Dockerfile', title: 'Docker update' };
      const diffContent = diffHeader('Dockerfile');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const infraRisk = risks.find(r => r.id === 'INFRA_K8S_CHANGE');
      expect(infraRisk).toBeTruthy();
    });

    test('should detect CI/CD configuration changes via .github/workflows/', () => {
      const files = [
        { filename: '.github/workflows/ci.yml', status: 'modified', additions: 20, deletions: 5 }
      ];
      const prDetails = { body: 'Update CI', title: 'CI update' };
      const diffContent = diffHeader('.github/workflows/ci.yml');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const cicdRisk = risks.find(r => r.id === 'INFRA_CICD_CHANGE');
      expect(cicdRisk).toBeTruthy();
    });

    test('should detect missing tests for source files', () => {
      const files = [
        { filename: 'src/services/userService.js', status: 'modified', additions: 50, deletions: 0 }
      ];
      const prDetails = { body: 'New service', title: 'Add user service' };
      const diffContent = diffHeader('src/services/userService.js');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const missingTestRisk = risks.find(r => r.id === 'TEST_MISSING');
      expect(missingTestRisk).toBeTruthy();
    });

    test('should not flag missing tests if test files are present', () => {
      const files = [
        { filename: 'src/services/userService.js', status: 'modified', additions: 50, deletions: 0 },
        { filename: 'src/services/userService.test.js', status: 'modified', additions: 30, deletions: 0 }
      ];
      const prDetails = { body: 'New service with tests', title: 'Add user service' };
      const diffContent = diffHeader('src/services/userService.js') + '\n' + diffHeader('src/services/userService.test.js');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const missingTestRisk = risks.find(r => r.id === 'TEST_MISSING');
      expect(missingTestRisk).toBeFalsy();
    });

    test('should detect terraform changes', () => {
      const files = [
        { filename: 'infrastructure/main.tf', status: 'modified', additions: 30, deletions: 5 }
      ];
      const prDetails = { body: 'Terraform update', title: 'Infra change' };
      const diffContent = diffHeader('infrastructure/main.tf');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const tfRisk = risks.find(r => r.id === 'INFRA_TERRAFORM_CHANGE');
      expect(tfRisk).toBeTruthy();
      expect(tfRisk.severity).toBe('high');
    });

    test('should detect Kubernetes changes', () => {
      const files = [
        { filename: 'k8s/deployment.yaml', status: 'modified', additions: 20, deletions: 10 }
      ];
      const prDetails = { body: 'K8s update', title: 'K8s' };
      const diffContent = diffHeader('k8s/deployment.yaml');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const k8sRisk = risks.find(r => r.id === 'INFRA_K8S_CHANGE');
      expect(k8sRisk).toBeTruthy();
    });

    test('should detect GitHub Actions workflow changes', () => {
      const files = [
        { filename: '.github/workflows/deploy.yml', status: 'modified', additions: 15, deletions: 5 }
      ];
      const prDetails = { body: 'Deploy workflow update', title: 'CI update' };
      const diffContent = diffHeader('.github/workflows/deploy.yml');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const cicdRisk = risks.find(r => r.id === 'INFRA_CICD_CHANGE');
      expect(cicdRisk).toBeTruthy();
    });

    test('should not duplicate risks when multiple files match same rule', () => {
      const files = [
        { filename: '.github/workflows/deploy.yml', status: 'modified', additions: 15, deletions: 5 },
        { filename: '.github/workflows/test.yml', status: 'modified', additions: 10, deletions: 2 }
      ];
      const prDetails = { body: 'CI updates', title: 'CI' };
      const diffContent = diffHeader('.github/workflows/deploy.yml') + '\n' + diffHeader('.github/workflows/test.yml');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const cicdRisks = risks.filter(r => r.id === 'INFRA_CICD_CHANGE');
      expect(cicdRisks.length).toBe(1);
    });

    test('should detect docker-compose changes', () => {
      const files = [
        { filename: 'docker-compose.yml', status: 'modified', additions: 10, deletions: 2 }
      ];
      const prDetails = { body: 'Docker compose update', title: 'Compose' };
      const diffContent = diffHeader('docker-compose.yml');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const k8sRisk = risks.find(r => r.id === 'INFRA_K8S_CHANGE');
      expect(k8sRisk).toBeTruthy();
    });

    test('should detect Prisma migration', () => {
      const files = [
        { filename: 'prisma/migrations/20240101_init/migration.sql', status: 'added', additions: 30, deletions: 0 }
      ];
      const prDetails = { body: 'Prisma migration', title: 'Prisma' };
      const diffContent = diffHeader('prisma/migrations/20240101_init/migration.sql', 'added');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      const migrationRisk = risks.find(r => r.id === 'DB_MIGRATION_ADD');
      expect(migrationRisk).toBeTruthy();
    });

    test('should not flag small PR with good description as risky', () => {
      const files = [
        { filename: 'src/utils.js', status: 'modified', additions: 30, deletions: 10 }
      ];
      const prDetails = { body: 'Refactored the utility function for better readability. Added JSDoc comments. No behavioral changes.', title: 'Refactor utils' };
      const diffContent = diffHeader('src/utils.js');

      const risks = analyzer.analyze(files, prDetails, diffContent);
      // Should only have TEST_MISSING (if tests existed before)
      // No critical or high risks expected for small, well-described PR
      const criticalOrHigh = risks.filter(r => ['critical', 'high'].includes(r.severity));
      expect(criticalOrHigh.length).toBe(0);
    });
  });
});

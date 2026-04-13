# 🛡️ PR Risk Analyzer

> GitHub Action that analyzes pull requests for high-risk patterns and posts actionable feedback directly on the PR.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-View-brightgreen)](https://github.com/marketplace)

---

## ✨ Features

PR Risk Analyzer automatically scans PR changes and detects:

### 🗄️ Database Risks
- New database migrations (SQL, Alembic, Flyway, Liquibase, TypeORM, Prisma)
- Modifications to existing migrations (dangerous — never modify committed migrations!)
- New database columns added
- Seed/test data changes

### 🔐 Security Risks
- **Hardcoded secrets** (API keys, passwords, private keys, tokens)
- Insecure CORS configuration (wildcard origins)
- SQL injection patterns
- Authentication/authorization bypass attempts
- SSL/TLS/certificate configuration changes

### ⚙️ Infrastructure Risks
- New environment variables introduced
- CI/CD pipeline configuration changes
- Kubernetes/Docker/Container configuration changes
- Terraform/Infrastructure-as-Code changes

### 📦 Dependency Risks
- New outgoing dependencies added
- Dependency version updates (major bumps)

### 🧪 Testing Coverage
- Detects when source files are changed without corresponding tests
- Recognizes new integration/E2E tests added

### 📝 PR Quality
- Large PR size warnings (>800 lines)
- Very large PR warnings (>1500 lines)
- Missing or empty PR descriptions

---

## 🚀 Quick Start

### Basic Usage

```yaml
name: PR Risk Analysis
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: pr-risk-analyzer/pr-risk-analyzer@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### With Blocking (Fail on Critical Issues)

```yaml
- uses: pr-risk-analyzer/pr-risk-analyzer@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-critical: true
    min-risk-threshold: high
```

### Full Configuration

```yaml
- uses: pr-risk-analyzer/pr-risk-analyzer@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-critical: true           # Fail check if critical issues found
    min-risk-threshold: high         # low|medium|high|critical
    comment-mode: replace            # append|replace|delete
    include-security-checks: true    # Enable security pattern detection
    include-test-checks: true        # Enable missing test detection
    include-size-checks: true        # Enable PR size warnings
    exclude-patterns: |              # Comma-separated glob patterns to skip
      **/*.json
      **/*.lock
```

---

## 📊 Output

The action posts a structured comment on your PR:

```
🛡️ PR Risk Analysis

✅ Verdict: 🟡 Medium Risk — 3 issues worth addressing before merge

| Severity | Count |
|----------|-------|
| 🚨 Critical | 0 |
| ⚠️ High | 1 |
| 🟡 Medium | 2 |
| ℹ️ Low | 0 |

📊 Change Statistics
| Metric | Value |
|--------|-------|
| 📁 Files Changed | 14 |
| ➕ Lines Added | +342 |
| ➖ Lines Deleted | -89 |
| 🆕 New Files | 3 |
| 📝 Modified Files | 11 |

🚩 Risk Breakdown

🔐 Security (1)
##### 🔐 Potential Hardcoded Secret Detected [HIGH]

> This PR may contain hardcoded secrets, API keys, or credentials.

Affected files:
  - `src/config/database.ts`
  - `src/services/payment.ts`

💡 Recommendations
- Remove hardcoded secrets immediately. Use environment variables or GitHub Secrets.
```

---

## ⚙️ Configuration Options

| Input | Description | Default |
|-------|-------------|---------|
| `github-token` | GitHub token (use `secrets.GITHUB_TOKEN`) | Required |
| `fail-on-critical` | Fail the check if critical issues are found | `false` |
| `min-risk-threshold` | Minimum risk level to trigger failure | `low` |
| `comment-mode` | How to post results: `append`, `replace`, `delete` | `replace` |
| `exclude-patterns` | Glob patterns to exclude from analysis | `""` |
| `include-security-checks` | Enable security pattern detection | `true` |
| `include-test-checks` | Enable missing test detection | `true` |
| `include-size-checks` | Enable PR size warnings | `true` |

---

## 🛠️ Action Outputs

The action sets these outputs for use in subsequent steps:

```yaml
- uses: pr-risk-analyzer/pr-risk-analyzer@v1
  id: risk-analysis
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Check results
  if: steps.risk-analysis.outputs.critical-count != '0'
  run: echo "Critical issues found!"
```

| Output | Description |
|--------|-------------|
| `total-risks` | Total number of risks found |
| `critical-count` | Number of critical risks |
| `high-count` | Number of high risks |
| `risk-level` | Overall risk level: `low`, `medium`, `high`, `critical` |

---

## 🔧 Supported File Types

### Database Migrations
- SQL migrations (`migrations/*.sql`, `db/migrate/**`)
- Alembic (Python)
- Flyway
- Liquibase
- Prisma
- TypeORM
- Knex.js

### Infrastructure
- Kubernetes YAML (`k8s/`, `kubernetes/`)
- Docker (`Dockerfile`, `docker-compose*.yml`)
- Terraform (`.tf` files)
- GitHub Actions (`.github/workflows/*.yml`)
- Helm charts

### Languages
- JavaScript / TypeScript
- Python
- Ruby
- Java
- Go
- C# / .NET
- PHP
- SQL

---

## 🧪 Example Workflows

### Enterprise Security-First Setup

```yaml
name: Security-First PR Review
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  pr-risk-check:
    runs-on: ubuntu-latest
    steps:
      - uses: pr-risk-analyzer/pr-risk-analyzer@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          fail-on-critical: true
          min-risk-threshold: high
          include-security-checks: true
          include-test-checks: true
          exclude-patterns: |
            **/*.md
            **/*.txt
            docs/**
```

### CI Only (No Comment Posting)

```yaml
- uses: pr-risk-analyzer/pr-risk-analyzer@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: delete
    fail-on-critical: true
```

### Selective Checks

```yaml
- uses: pr-risk-analyzer/pr-risk-analyzer@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    include-security-checks: true
    include-test-checks: false
    include-size-checks: false
```

---

## 📋 Detected Risk Categories

| Category | Risk Level | Examples |
|----------|-----------|---------|
| Database Migration Added | 🚨 Critical | New `.sql` migration files |
| Existing Migration Modified | 🚨 Critical | Altering committed migration |
| Hardcoded Secrets | 🚨 Critical | API keys, passwords in code |
| Auth Bypass Patterns | 🚨 Critical | `skip_auth`, middleware disabled |
| SQL Injection Patterns | ⚠️ High | Raw SQL with string concatenation |
| New Environment Variables | ⚠️ High | `.env` or `config.ts` changes |
| Infrastructure Changes | ⚠️ High | K8s, Terraform, Docker changes |
| New Dependencies | 🟡 Medium | New packages added |
| Large PR (>800 lines) | 🟡 Medium | Size threshold warnings |
| Missing Tests | 🟡 Medium | Source files without tests |
| No PR Description | 🟡 Medium | Empty or very short body |
| New Integration Tests | ℹ️ Low | Test files being added |

---

## 🏗️ Development

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/pr-risk-analyzer/pr-risk-analyzer.git
cd pr-risk-analyzer
npm install
```

### Build

```bash
npm run build
```

This compiles `src/index.js` → `dist/index.js` using `@vercel/ncc`.

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

---

## 🤝 Contributing

Contributions welcome! Please open an issue first to discuss changes.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-risk-rule`)
3. Commit your changes (`git commit -m 'Add XYZ risk detection'`)
4. Push to the branch (`git push origin feature/my-risk-rule`)
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](./LICENSE)

---

## 🙏 Acknowledgments

Built with:
- [@actions/core](https://github.com/actions/toolkit/tree/main/packages/core)
- [@actions/github](https://github.com/actions/toolkit/tree/main/packages/github)
- [GitHub REST API](https://docs.github.com/en/rest)

/**
 * Diff Analyzer - Analyzes PR diffs against risk rules
 */
const { RISK_RULES } = require('./riskRules');
const { minimatch } = require('minimatch');

class DiffAnalyzer {
  constructor() {
    this.foundRisks = [];
  }

  /**
   * Analyze changed files and diff content against all rules
   * @param {Array} changedFiles - List of {filename, status, additions, deletions, patch}
   * @param {Object} prDetails - PR metadata (body, title, user, etc.)
   * @param {string} diffContent - Full unified diff content
   */
  analyze(changedFiles, prDetails, diffContent) {
    this.foundRisks = [];
    const stats = this._computeStats(changedFiles);

    for (const rule of RISK_RULES) {
      this._checkRule(rule, changedFiles, prDetails, diffContent, stats);
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    this.foundRisks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return this.foundRisks;
  }

  _checkRule(rule, changedFiles, prDetails, diffContent, stats) {
    switch (rule.id) {
      case 'PR_SIZE_LARGE':
        if (stats.totalAdditions >= rule.diffSizeThreshold) {
          this._addRisk(rule, { linesAdded: stats.totalAdditions });
        }
        break;

      case 'PR_SIZE_XLARGE':
        if (stats.totalAdditions >= rule.diffSizeThreshold) {
          this._addRisk(rule, { linesAdded: stats.totalAdditions });
        }
        break;

      case 'PR_NO_DESCRIPTION':
        if (!prDetails.body || prDetails.body.trim().length < 10) {
          this._addRisk(rule, {});
        }
        break;

      case 'PR_NO_BODY':
        if (prDetails.body && prDetails.body.trim().length < 30 && prDetails.body.trim().length >= 10) {
          this._addRisk(rule, { bodyLength: prDetails.body.trim().length });
        }
        break;

      case 'TEST_MISSING':
        this._checkMissingTests(rule, changedFiles);
        break;

      default:
        this._checkFileAndContentRules(rule, changedFiles, diffContent);
        break;
    }
  }

  _checkFileAndContentRules(rule, changedFiles, diffContent) {
    let matchedFiles = [];

    // File pattern matching
    if (rule.filePatterns && rule.filePatterns.length > 0) {
      matchedFiles = changedFiles.filter(f => this._matchesAnyPattern(f.filename, rule.filePatterns));
    }

    // Content pattern matching
    if (rule.contentPatterns && rule.contentPatterns.length > 0 && matchedFiles.length > 0) {
      const contentMatches = this._findContentMatches(diffContent, rule.contentPatterns, matchedFiles.map(f => f.filename));
      if (contentMatches.length > 0) {
        this._addRisk(rule, {
          files: contentMatches.map(m => m.file),
          matchedLines: contentMatches.map(m => m.line),
          matchedContent: contentMatches.map(m => m.content).slice(0, 3),
        });
        return;
      }
    }

    // Pure file pattern match (no content check)
    if (matchedFiles.length > 0 && (!rule.contentPatterns || rule.contentPatterns.length === 0)) {
      this._addRisk(rule, {
        files: matchedFiles.map(f => f.filename),
        count: matchedFiles.length,
      });
    }
  }

  _findContentMatches(diffContent, patterns, filenames) {
    const matches = [];
    const lines = diffContent.split('\n');
    let currentFile = null;

    for (const line of lines) {
      const fileMatch = line.match(/^diff --git a\/(.*) b\//);
      if (fileMatch) {
        currentFile = fileMatch[1];
      }

      if (!filenames.includes(currentFile)) continue;

      for (const patternDef of patterns) {
        try {
          const regex = new RegExp(patternDef.pattern, patternDef.flags || '');
          if (regex.test(line)) {
            matches.push({
              file: currentFile,
              line: line.substring(0, 50),
              content: line.trim().substring(0, 120),
            });
          }
        } catch (e) {
          // Invalid regex, skip
        }
      }
    }

    return matches;
  }

  _checkMissingTests(rule, changedFiles) {
    const sourceExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.java', '.go', '.cs', '.php'];
    const testExtensions = ['.test.js', '.test.ts', '.test.jsx', '.test.tsx', '_test.py', '_spec.rb', '.test.rb', '.spec.js', '.spec.ts', '.spec.jsx', '.spec.tsx'];

    const changedSourceFiles = changedFiles.filter(f => {
      const isSource = sourceExtensions.some(ext => f.filename.endsWith(ext));
      const isTest = testExtensions.some(ext => f.filename.includes(ext));
      const isSpec = f.filename.includes('__tests__') || f.filename.includes('/test/') || f.filename.includes('/tests/');
      return isSource && !isTest && !isSpec && !f.filename.includes('node_modules');
    });

    if (changedSourceFiles.length === 0) return;

    const changedTestFiles = changedFiles.filter(f => {
      return testExtensions.some(ext => f.filename.includes(ext)) ||
             f.filename.includes('__tests__') ||
             f.filename.includes('/test/') ||
             f.filename.includes('/tests/') ||
             f.filename.includes('_test.') ||
             f.filename.includes('_spec.');
    });

    const untestedFiles = [];
    for (const srcFile of changedSourceFiles) {
      const srcBase = srcFile.filename.replace(/\.[^.]+$/, '');
      const srcName = srcBase.split('/').pop();
      const hasTest = changedTestFiles.some(tf => {
        const tfBase = tf.filename.replace(/\.[^.]+$/, '');
        return tfBase.includes(srcName) || tf.filename.includes(srcName);
      });
      if (!hasTest) {
        untestedFiles.push(srcFile);
      }
    }

    if (untestedFiles.length > 0) {
      this._addRisk(rule, {
        files: untestedFiles.slice(0, 10),
        count: untestedFiles.length,
      });
    }
  }

  _matchesAnyPattern(filename, patterns) {
    for (const pattern of patterns) {
      // minimatch handles **, *, ? glob patterns correctly
      if (minimatch(filename, pattern, { dot: true })) return true;
      // Also try without leading ./
      if (minimatch(filename, pattern.replace(/^\.\//, ''), { dot: true })) return true;
    }
    return false;
  }

  _computeStats(changedFiles) {
    return changedFiles.reduce((acc, f) => {
      acc.totalFiles++;
      acc.totalAdditions += f.additions || 0;
      acc.totalDeletions += f.deletions || 0;
      acc.newFiles += f.status === 'added' ? 1 : 0;
      acc.modifiedFiles += f.status === 'modified' ? 1 : 0;
      return acc;
    }, { totalFiles: 0, totalAdditions: 0, totalDeletions: 0, newFiles: 0, modifiedFiles: 0 });
  }

  _addRisk(rule, details) {
    if (this.foundRisks.some(r => r.id === rule.id)) return;

    this.foundRisks.push({
      id: rule.id,
      name: rule.name,
      severity: rule.severity,
      category: rule.category,
      emoji: rule.emoji,
      description: rule.description,
      recommendation: rule.recommendation,
      details,
    });
  }
}

module.exports = { DiffAnalyzer };

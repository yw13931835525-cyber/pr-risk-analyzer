/**
 * Comment Formatter - Formats the PR risk analysis as a Markdown comment
 */

class CommentFormatter {
  constructor() {
    this.MAX_FILES_SHOWN = 8;
    this.MAX_CONTENT_LINES = 3;
  }

  /**
   * Format risk analysis results as a Markdown PR comment
   * @param {Object} results - { risks, stats, prDetails }
   */
  formatComment(results) {
    const { risks, stats, prDetails, threshold } = results;

    const lines = [];

    lines.push(this._buildHeader());
    lines.push(this._buildSummary(risks, stats));
    lines.push(this._buildStats(stats));

    if (risks.length === 0) {
      lines.push(this._buildAllClear());
    } else {
      lines.push(this._buildRiskBreakdown(risks));
      lines.push(this._buildRecommendations(risks));
    }

    lines.push(this._buildFooter());

    return lines.join('\n');
  }

  _buildHeader() {
    return `## 🛡️ PR Risk Analysis

| Category | Count |
|----------|-------|
`;
  }

  _buildSummary(risks, stats) {
    const criticalCount = risks.filter(r => r.severity === 'critical').length;
    const highCount = risks.filter(r => r.severity === 'high').length;
    const mediumCount = risks.filter(r => r.severity === 'medium').length;
    const lowCount = risks.filter(r => r.severity === 'low').length;

    const totalIssues = risks.length;
    const hasBlockingIssues = criticalCount > 0 || highCount > 0;

    let verdict = '✅ **Low Risk** — Looks good to merge';
    let verdictEmoji = '✅';

    if (criticalCount > 0) {
      verdict = `🚨 **Critical Risk** — ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} require${criticalCount === 1 ? 's' : ''} immediate attention`;
      verdictEmoji = '🚨';
    } else if (highCount > 0) {
      verdict = `⚠️ **High Risk** — ${highCount} high-severity issue${highCount > 1 ? 's' : ''} need${highCount === 1 ? 's' : ''} review before merge`;
      verdictEmoji = '⚠️';
    } else if (mediumCount > 0) {
      verdict = `🟡 **Medium Risk** — ${mediumCount} issue${mediumCount > 1 ? 's' : ''} worth addressing before merge`;
      verdictEmoji = '🟡';
    } else if (lowCount > 0) {
      verdict = `✅ **Low Risk** — ${lowCount} minor issue${lowCount > 1 ? 's' : ''}, largely good to go`;
      verdictEmoji = '✅';
    }

    const lines = [
      `### ${verdictEmoji} Verdict: ${verdict}`,
      ``,
      `| Severity | Count |`,
      `|----------|-------|`,
      `| 🚨 Critical | ${criticalCount} |`,
      `| ⚠️ High | ${highCount} |`,
      `| 🟡 Medium | ${mediumCount} |`,
      `| ℹ️ Low | ${lowCount} |`,
      ``,
    ];

    return lines.join('\n');
  }

  _buildStats(stats) {
    return [
      `### 📊 Change Statistics`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| 📁 Files Changed | ${stats.totalFiles} |`,
      `| ➕ Lines Added | +${stats.totalAdditions} |`,
      `| ➖ Lines Deleted | -${stats.totalDeletions} |`,
      `| 🆕 New Files | ${stats.newFiles} |`,
      `| 📝 Modified Files | ${stats.modifiedFiles} |`,
      ``,
    ].join('\n');
  }

  _buildAllClear() {
    return [
      `### ✅ All Checks Passed`,
      ``,
      `No high-risk patterns detected in this PR. The changes look safe to merge.`,
      ``,
      `> 💡 This analysis is automated. Always exercise good judgment when reviewing.`,
      ``,
    ].join('\n');
  }

  _buildRiskBreakdown(risks) {
    const lines = [`### 🚩 Risk Breakdown`, ``];

    const grouped = {};
    for (const risk of risks) {
      if (!grouped[risk.category]) grouped[risk.category] = [];
      grouped[risk.category].push(risk);
    }

    const categoryEmoji = {
      database: '🗄️',
      security: '🔐',
      infrastructure: '⚙️',
      dependencies: '📦',
      testing: '🧪',
      quality: '📝',
    };

    const categoryLabel = {
      database: 'Database',
      security: 'Security',
      infrastructure: 'Infrastructure',
      dependencies: 'Dependencies',
      testing: 'Testing',
      quality: 'PR Quality',
    };

    for (const [category, categoryRisks] of Object.entries(grouped)) {
      const emoji = categoryEmoji[category] || '📋';
      const label = categoryLabel[category] || category;
      const count = categoryRisks.length;

      lines.push(`#### ${emoji} ${label} (${count})`);
      lines.push(``);

      for (const risk of categoryRisks) {
        const severityBadge = this._severityBadge(risk.severity);
        lines.push(`##### ${risk.emoji} ${risk.name} ${severityBadge}`);
        lines.push(``);
        lines.push(`> ${risk.description}`);
        lines.push(``);

        if (risk.details && risk.details.files && risk.details.files.length > 0) {
          const files = risk.details.files.slice(0, this.MAX_FILES_SHOWN);
          lines.push(`**Affected files:**`);
          for (const file of files) {
            lines.push(`  - \`${this._truncateFile(file, 70)}\``);
          }
          if (risk.details.files.length > this.MAX_FILES_SHOWN) {
            lines.push(`  - *...and ${risk.details.files.length - this.MAX_FILES_SHOWN} more*`);
          }
          lines.push(``);
        }

        if (risk.details && risk.details.matchedContent && risk.details.matchedContent.length > 0) {
          lines.push(`**Matched content:**`);
          for (const content of risk.details.matchedContent.slice(0, this.MAX_CONTENT_LINES)) {
            lines.push(`  \`\`\``);
            lines.push(`  ${this._escapeInlineCode(content)}`);
            lines.push(`  \`\`\``);
          }
          lines.push(``);
        }
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  _buildRecommendations(risks) {
    const lines = [`### 💡 Recommendations`, ``];

    for (const risk of risks) {
      lines.push(`**${risk.emoji} ${risk.name}**`);
      lines.push(`- ${risk.recommendation}`);
      lines.push(``);
    }

    return lines.join('\n');
  }

  _severityBadge(severity) {
    const badges = {
      critical: '`[CRITICAL]`',
      high: '`[HIGH]`',
      medium: '`[MEDIUM]`',
      low: '`[LOW]`',
    };
    return badges[severity] || `\`[${severity.toUpperCase()}]\``;
  }

  _truncateFile(file, maxLen) {
    if (file.length <= maxLen) return file;
    const parts = file.split('/');
    const filename = parts.pop();
    const truncated = '…/' + parts.slice(-2).join('/') + '/' + filename;
    if (truncated.length > maxLen) {
      return '…/' + parts.pop() + '/' + filename;
    }
    return truncated;
  }

  _escapeInlineCode(text) {
    if (!text) return '';
    return text.replace(/`/g, '\\`').substring(0, 100);
  }

  _buildFooter() {
    return [
      `---`,
      ``,
      `> 🤖 *PR Risk Analysis is automated. This analysis is not a substitute for human code review.*`,
      `> *Generated by [pr-risk-analyzer](https://github.com/marketplace/pr-risk-analyzer)*`,
    ].join('\n');
  }
}

module.exports = { CommentFormatter };

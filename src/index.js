/**
 * PR Risk Analyzer - GitHub Action Entry Point
 *
 * Analyzes pull requests for high-risk patterns and posts actionable feedback.
 *
 * Usage:
 *   uses: ./pr-risk-analyzer@v1
 *   with:
 *     github-token: ${{ secrets.GITHUB_TOKEN }}
 *     fail-on-critical: true
 *     min-risk-threshold: low
 */

const core = require('@actions/core');
const github = require('@actions/github');
const { DiffAnalyzer } = require('./diffAnalyzer');
const { CommentFormatter } = require('./commentFormatter');

async function run() {
  try {
    const inputs = {
      token: core.getInput('github-token', { required: true }),
      minRiskThreshold: core.getInput('min-risk-threshold') || 'low',
      failOnCritical: core.getInput('fail-on-critical') === 'true',
      commentMode: core.getInput('comment-mode') || 'replace',
      excludePatterns: core.getInput('exclude-patterns') || '',
      includeSecurityChecks: core.getInput('include-security-checks') !== 'false',
      includeTestChecks: core.getInput('include-test-checks') !== 'false',
      includeSizeChecks: core.getInput('include-size-checks') !== 'false',
    };

    const octokit = github.getOctokit(inputs.token);
    const context = github.context;
    const prNumber = context.payload.pull_request?.number;
    const repoOwner = context.repo.owner;
    const repoName = context.repo.repo;

    if (!prNumber) {
      core.info('Not a pull request event. Skipping.');
      return;
    }

    core.info(`🔍 Analyzing PR #${prNumber} in ${repoOwner}/${repoName}`);

    // ── Fetch PR details ────────────────────────────────────────────────────
    const { data: prDetails } = await octokit.rest.pulls.get({
      owner: repoOwner,
      repo: repoName,
      pull_number: prNumber,
    });

    // ── Fetch changed files ─────────────────────────────────────────────────
    const changedFiles = await fetchChangedFiles(octokit, repoOwner, repoName, prNumber);

    // ── Fetch diff content ─────────────────────────────────────────────────
    const diffContent = await fetchDiffContent(octokit, repoOwner, repoName, prNumber);

    // ── Run analysis ───────────────────────────────────────────────────────
    const analyzer = new DiffAnalyzer();
    const risks = analyzer.analyze(changedFiles, prDetails, diffContent);

    const stats = computeStats(changedFiles);
    core.info(`📊 Found ${risks.length} risk(s): ${risks.map(r => r.name).join(', ')}`);

    // ── Determine verdict ──────────────────────────────────────────────────
    const hasCritical = risks.some(r => r.severity === 'critical');
    const hasHigh = risks.some(r => r.severity === 'high');
    const hasBlocking = hasCritical || hasHigh;

    if (hasBlocking) {
      core.warning(`⚠️ High-risk patterns detected in PR #${prNumber}`);
    }

    // ── Format comment ─────────────────────────────────────────────────────
    const formatter = new CommentFormatter();
    const commentBody = formatter.formatComment({ risks, stats, prDetails, threshold: inputs.minRiskThreshold });

    // ── Post/Update comment ────────────────────────────────────────────────
    await postPRComment(octokit, repoOwner, repoName, prNumber, commentBody, inputs.commentMode);

    // ── Set output ─────────────────────────────────────────────────────────
    core.setOutput('total-risks', String(risks.length));
    core.setOutput('critical-count', String(risks.filter(r => r.severity === 'critical').length));
    core.setOutput('high-count', String(risks.filter(r => r.severity === 'high').length));
    core.setOutput('risk-level', hasCritical ? 'critical' : hasHigh ? 'high' : risks.length > 0 ? 'medium' : 'low');

    // ── Fail if needed ─────────────────────────────────────────────────────
    if (inputs.failOnCritical && hasCritical) {
      core.setFailed(`PR Risk Analyzer found ${risks.filter(r => r.severity === 'critical').length} critical risk(s). Blocking merge as requested.`);
      return;
    }

    const threshold = { critical: 0, high: 1, medium: 2, low: 3 };
    if (threshold[hasBlocking ? 'high' : risks.length > 0 ? 'medium' : 'low'] <= threshold[inputs.minRiskThreshold]) {
      if (hasBlocking) {
        core.setFailed(`PR Risk Analyzer found high-severity issues (threshold: ${inputs.minRiskThreshold}).`);
      }
    }

    core.info(`✅ PR Risk Analysis complete. ${risks.length} issue(s) found.`);
  } catch (error) {
    core.error(`❌ PR Risk Analyzer error: ${error.message}`);
    core.error(error.stack);
    core.setFailed(error.message);
  }
}

async function fetchChangedFiles(octokit, owner, repo, prNumber) {
  const files = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: perPage,
      page,
    });

    files.push(...data.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch || '',
    })));

    if (data.length < perPage) break;
    page++;
  }

  return files;
}

async function fetchDiffContent(octokit, owner, repo, prNumber) {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: 'diff' },
  });

  return typeof data === 'string' ? data : '';
}

async function postPRComment(octokit, owner, repo, prNumber, body, mode) {
  const marker = '<!-- pr-risk-analyzer -->';

  if (mode === 'delete') {
    // Delete all analyzer comments
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    for (const comment of comments) {
      if (comment.body.includes(marker)) {
        await octokit.rest.issues.deleteComment({
          owner,
          repo,
          comment_id: comment.id,
        });
      }
    }
    return;
  }

  // Find existing analyzer comment
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });

  const existingComment = comments.find(c => c.body.includes(marker));

  if (existingComment && mode === 'replace') {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body: marker + '\n\n' + body,
    });
    core.info(`📝 Updated existing risk analysis comment (${existingComment.id})`);
  } else {
    const { data: newComment } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: marker + '\n\n' + body,
    });
    core.info(`📝 Created new risk analysis comment (${newComment.id})`);
  }
}

function computeStats(changedFiles) {
  return changedFiles.reduce((acc, f) => {
    acc.totalFiles++;
    acc.totalAdditions += f.additions || 0;
    acc.totalDeletions += f.deletions || 0;
    if (f.status === 'added') acc.newFiles++;
    if (f.status === 'modified') acc.modifiedFiles++;
    return acc;
  }, { totalFiles: 0, totalAdditions: 0, totalDeletions: 0, newFiles: 0, modifiedFiles: 0 });
}

run();

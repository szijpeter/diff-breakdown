const {
  analyzeChanges,
  renderMarkdown,
  parseConfigText,
  normalizeConfig,
} = require('./index.cjs')

function decodeContent(response) {
  if (!response || Array.isArray(response.data) || response.data.type !== 'file') throw new Error('Configuration path does not identify a file')
  return Buffer.from(response.data.content, response.data.encoding || 'base64').toString('utf8')
}

async function loadTrustedConfig({ octokit, owner, repo, ref, requestedPath, logger = { info() {} } }) {
  const candidates = [requestedPath]
  if (requestedPath.endsWith('.yml')) candidates.push(requestedPath.replace(/\.yml$/, '.yaml'), requestedPath.replace(/\.yml$/, '.json'))
  for (const configPath of [...new Set(candidates)]) {
    try {
      const response = await octokit.rest.repos.getContent({ owner, repo, path: configPath, ref })
      return { config: parseConfigText(decodeContent(response), `${configPath}@${ref}`), path: configPath }
    } catch (error) {
      if (error.status !== 404) throw error
    }
  }
  logger.info(`No trusted configuration found at ${candidates.join(', ')}; using auto-detected defaults`)
  return { config: normalizeConfig(), path: null }
}

async function upsertComment({ octokit, owner, repo, prNumber, marker, body, authorLogin = 'github-actions[bot]' }) {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  })
  const existing = comments.find(comment => comment.user?.login === authorLogin && comment.body?.includes(marker))
  if (!existing) {
    await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body })
    return 'created'
  }
  if (existing.body === body) return 'unchanged'
  await octokit.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body })
  return 'updated'
}

async function runAction(core, github) {
  const token = core.getInput('token', { required: true })
  const octokit = github.getOctokit(token)
  const { owner, repo } = github.context.repo
  const eventPr = github.context.payload.pull_request?.number
  const inputPr = core.getInput('pr-number')
  const prNumber = inputPr ? Number(inputPr) : Number(eventPr)
  if (!Number.isInteger(prNumber) || prNumber <= 0) throw new Error(`Invalid or missing pull request number: ${inputPr || eventPr || ''}`)

  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber })
  const trustedRef = pr.base.sha
  const loaded = await loadTrustedConfig({
    octokit,
    owner,
    repo,
    ref: trustedRef,
    requestedPath: core.getInput('config-path') || '.github/diff-breakdown.yml',
    logger: core,
  })
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, { owner, repo, pull_number: prNumber, per_page: 100 })
  const incomplete = pr.changed_files > files.length
  const profile = analyzeChanges({
    files,
    config: loaded.config,
    context: {
      repository: `${owner}/${repo}`,
      pullRequest: prNumber,
      base: pr.base.ref,
      head: pr.head.sha,
      configuration: {
        source: loaded.path || 'built-in defaults',
        ref: loaded.path ? trustedRef : null,
      },
    },
    expected: { files: pr.changed_files, additions: pr.additions, deletions: pr.deletions },
    incomplete,
  })
  const markdown = renderMarkdown(profile, loaded.config)
  if (markdown.length > 64000) throw new Error(`Rendered comment is ${markdown.length} characters; reduce comment limits below GitHub's safe comment size`)

  if (core.getBooleanInput('comment')) {
    const result = await upsertComment({ octokit, owner, repo, prNumber, marker: loaded.config.marker, body: markdown })
    core.info(`Profile comment ${result}`)
  }
  if (core.getBooleanInput('summary')) await core.summary.addRaw(renderMarkdown(profile, loaded.config, { includeMarker: false })).write()

  core.setOutput('total-files', String(profile.totals.files))
  core.setOutput('total-churn', String(profile.totals.churn))
  core.setOutput('warning-count', String(profile.warnings.length))
  core.info(`PR #${prNumber}: ${profile.totals.files} files, ${profile.totals.churn} lines of churn, ${profile.warnings.length} warnings`)
}

async function run() {
  const core = await import('@actions/core')
  const github = await import('@actions/github')
  return runAction(core, github)
}

if (require.main === module) {
  run().catch(async error => {
    const core = await import('@actions/core')
    core.setFailed(error instanceof Error ? error.message : String(error))
  })
}

module.exports = { decodeContent, loadTrustedConfig, upsertComment, runAction, run }

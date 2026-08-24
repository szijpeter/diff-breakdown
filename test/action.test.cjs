const test = require('node:test')
const assert = require('node:assert/strict')
const { decodeContent, loadTrustedConfig, upsertComment, runAction } = require('../src/action.cjs')

test('decodes repository configuration files', () => {
  const text = 'version: 1\ntitle: Example\n'
  assert.equal(decodeContent({ data: { type: 'file', encoding: 'base64', content: Buffer.from(text).toString('base64') } }), text)
  assert.throws(() => decodeContent({ data: [] }), /does not identify a file/)
})

test('loads configuration only through the requested trusted ref', async () => {
  const calls = []
  const octokit = {
    rest: { repos: { getContent: async args => {
      calls.push(args)
      return { data: { type: 'file', encoding: 'base64', content: Buffer.from('version: 1\ntitle: Trusted\n').toString('base64') } }
    } } },
  }
  const loaded = await loadTrustedConfig({ octokit, owner: 'o', repo: 'r', ref: 'base-sha', requestedPath: '.github/diff-breakdown.yml' })
  assert.equal(loaded.config.title, 'Trusted')
  assert.deepEqual(calls[0], { owner: 'o', repo: 'r', path: '.github/diff-breakdown.yml', ref: 'base-sha' })
})

test('creates, updates, and preserves the marker comment', async () => {
  const calls = []
  const issues = {
    listComments: Symbol('listComments'),
    createComment: async args => calls.push(['create', args]),
    updateComment: async args => calls.push(['update', args]),
  }
  const octokit = { rest: { issues }, paginate: async () => [] }
  assert.equal(await upsertComment({ octokit, owner: 'o', repo: 'r', prNumber: 1, marker: '<!-- m -->', body: '<!-- m -->\nnew' }), 'created')
  assert.equal(calls[0][0], 'create')

  octokit.paginate = async () => [{ id: 2, user: { login: 'github-actions[bot]' }, body: '<!-- m -->\nold' }]
  assert.equal(await upsertComment({ octokit, owner: 'o', repo: 'r', prNumber: 1, marker: '<!-- m -->', body: '<!-- m -->\nnew' }), 'updated')
  assert.equal(calls[1][1].comment_id, 2)

  octokit.paginate = async () => [{ id: 3, user: { login: 'github-actions[bot]' }, body: '<!-- m -->\nnew' }]
  assert.equal(await upsertComment({ octokit, owner: 'o', repo: 'r', prNumber: 1, marker: '<!-- m -->', body: '<!-- m -->\nnew' }), 'unchanged')
})

test('never takes over a marker comment from another actor or bot', async () => {
  const calls = []
  const issues = {
    listComments: Symbol('listComments'),
    createComment: async args => calls.push(args),
    updateComment: async () => assert.fail('must not update a user comment'),
  }
  const octokit = {
    rest: { issues },
    paginate: async () => [
      { id: 2, user: { login: 'someone' }, body: '<!-- m -->\nspoof' },
      { id: 3, user: { login: 'other-app[bot]' }, body: '<!-- m -->\nspoof' },
    ],
  }
  await upsertComment({ octokit, owner: 'o', repo: 'r', prNumber: 1, marker: '<!-- m -->', body: '<!-- m -->\nnew' })
  assert.equal(calls.length, 1)
})

test('runs the metadata-only action against the exact pull-request base commit', async () => {
  const outputs = {}
  const comments = []
  const summaries = []
  const configCalls = []
  const inputs = { token: 'test-token', 'pr-number': '', 'config-path': '', comment: 'true', summary: 'true' }
  const core = {
    getInput: name => inputs[name] || '',
    getBooleanInput: name => inputs[name] === 'true',
    setOutput: (name, value) => { outputs[name] = value },
    info() {},
    summary: {
      addRaw(value) { summaries.push(value); return this },
      async write() {},
    },
  }
  const listFiles = Symbol('listFiles')
  const listComments = Symbol('listComments')
  const octokit = {
    rest: {
      pulls: {
        get: async () => ({ data: {
          changed_files: 1,
          additions: 5,
          deletions: 1,
          base: { ref: 'main', sha: 'base-commit-sha' },
          head: { sha: 'head-commit-sha' },
        } }),
        listFiles,
      },
      repos: {
        getContent: async args => {
          configCalls.push(args)
          const error = new Error('not found')
          error.status = 404
          throw error
        },
      },
      issues: {
        listComments,
        createComment: async args => comments.push(args),
        updateComment: async () => assert.fail('must create on first run'),
      },
    },
    paginate: async route => route === listFiles
      ? [{ filename: 'src/main/java/App.java', status: 'modified', additions: 5, deletions: 1 }]
      : [],
  }
  const github = {
    context: {
      repo: { owner: 'owner', repo: 'repo' },
      payload: { pull_request: { number: 17 } },
    },
    getOctokit: token => {
      assert.equal(token, 'test-token')
      return octokit
    },
  }

  await runAction(core, github)

  assert.deepEqual(configCalls.map(call => [call.path, call.ref]), [
    ['.github/diff-breakdown.yml', 'base-commit-sha'],
    ['.github/diff-breakdown.yaml', 'base-commit-sha'],
    ['.github/diff-breakdown.json', 'base-commit-sha'],
  ])
  assert.equal(comments.length, 1)
  assert.match(comments[0].body, /<!-- diff-breakdown:v1 -->/)
  assert.equal(summaries.length, 1)
  assert.doesNotMatch(summaries[0], /<!-- diff-breakdown:v1 -->/)
  assert.deepEqual(outputs, { 'total-files': '1', 'total-churn': '6', 'warning-count': '0' })
})

const test = require('node:test')
const assert = require('node:assert/strict')
const { analyzeChanges } = require('../src/analyze.cjs')
const { parseConfigText } = require('../src/config.cjs')
const { renderMarkdown } = require('../src/render-markdown.cjs')

function example() {
  const config = parseConfigText(`
version: 1
title: Cross-platform change map
presets: [kotlin-gradle, swift-package]
dependencyGraph:
  edges:
    - { from: app, to: core }
`)
  const files = [
    { filename: 'core/src/commonMain/kotlin/Core.kt', additions: 20, deletions: 3, status: 'modified' },
    { filename: 'core/src/commonTest/kotlin/CoreTest.kt', additions: 15, deletions: 0, status: 'added' },
    { filename: 'core/api/core.api', additions: 1, deletions: 1, status: 'modified', patch: '@@\n-public fun old(): Unit\n+public fun new(): Unit' },
    { filename: 'Sources/App/App.swift', additions: 12, deletions: 2, status: 'modified' },
    { filename: 'experimental/<script>|bad\n.kt', additions: 1, deletions: 0, status: 'added' },
  ]
  const profile = analyzeChanges({ files, config, context: { repository: 'owner/repo', pullRequest: 7, base: 'main/<unsafe>', head: 'abcdef1234567890' } })
  return { config, profile }
}

test('renders visual Markdown with exact tables and escaped metadata', () => {
  const { config, profile } = example()
  const markdown = renderMarkdown(profile, config)
  assert.match(markdown, /<!-- diff-breakdown:v1 -->/)
  assert.match(markdown, /```mermaid\npie showData/)
  assert.match(markdown, /Module change matrix/)
  assert.match(markdown, /Platform \/ source-set distribution/)
  assert.match(markdown, /\| Platform \| Files \| Production \| Tests \| Other \|/)
  assert.match(markdown, /Configured dependency impact/)
  assert.match(markdown, /sha256:[a-f0-9]{12}/)
  assert.match(markdown, /Public API baseline delta/)
  assert.doesNotMatch(markdown, /<script>|<unsafe>/)
  assert.match(markdown, /&lt;script&gt;/)
  assert.doesNotMatch(markdown, /Test \/ published additions/)
})

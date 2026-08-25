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
  assert.match(markdown, /<sub>base <code>main\/&lt;unsafe&gt;<\/code> · head <code>abcdef123456<\/code><\/sub>/)
  assert.match(markdown, /\*\*5 files\*\* · 🟢 \*\*\+49 added\*\* · 🔴 \*\*−6 deleted\*\* · \*\*2 modules\*\* · \*\*2 platforms\*\* · \*\*1 potential dependent\*\*/)
  assert.match(markdown, /\| Category \| Files \| 🟢 Added \| 🔴 Deleted \| 📊 Change share \|/)
  assert.match(markdown, /\| 📦 Production source \| 2 \| \*\*\+32\*\* \| \*\*−5\*\* \| `██████▊░░░` 67\.3% \|/)
  assert.match(markdown, /\| ⚠️ Unclassified source \| 1 \| \*\*\+1\*\* \| \*\*−0\*\* \| `▏░░░░░░░░░` 1\.8% \|/)
  assert.doesNotMatch(markdown, /\| Category \|[^\n]*\| Churn \|/)
  assert.match(markdown, /<summary>Change form — 2 added, 3 modified<\/summary>/)
  assert.match(markdown, /<summary>Module change matrix — 2 changed modules<\/summary>/)
  assert.match(markdown, /\| <code>App<\/code> \| ▓ 14 \| · \| · \| \*\*14\*\* \|/)
  assert.doesNotMatch(markdown, /· 0/)
  assert.match(markdown, /<summary>Platform distribution — 2 platforms<\/summary>/)
  assert.match(markdown, /\| Platform \| Files \| Production \| Tests \| Other \| 📊 Change share \|/)
  assert.doesNotMatch(markdown, /\| Platform \|[^\n]*\| Added \| Deleted \| Churn \|/)
  assert.match(markdown, /<summary>Public API baseline — 1 visible addition, 1 visible removal<\/summary>/)
  assert.match(markdown, /<summary>Dependency reach — 1 potential dependent<\/summary>/)
  assert.match(markdown, /<summary>Visualizations — change composition<\/summary>/)
  assert.match(markdown, /```mermaid\npie showData/)
  assert.ok(markdown.indexOf('| Category |') < markdown.indexOf('```mermaid'))
  assert.ok(markdown.indexOf('Dependency reach') < markdown.indexOf('Visualizations'))
  assert.match(markdown, /sha256:[a-f0-9]{12}/)
  assert.doesNotMatch(markdown, /<script>|<unsafe>/)
  assert.match(markdown, /&lt;script&gt;/)
  assert.doesNotMatch(markdown, /Test \/ published additions/)
})

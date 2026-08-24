const test = require('node:test')
const assert = require('node:assert/strict')
const { configurationDigest, parseConfigText, normalizeConfig } = require('../src/config.cjs')

test('normalizes the zero-config profile', () => {
  const config = normalizeConfig()
  assert.equal(config.version, 1)
  assert.deepEqual(config.presets, ['auto'])
  assert.equal(config.categoryById.production.label, 'Production source')
  assert.ok(config.views.includes('modules'))
})

test('parses YAML overrides and custom path rules', () => {
  const config = parseConfigText(`
version: 1
title: Mobile change map
presets: [kotlin-gradle, swift-package]
categories:
  - id: contracts
    label: Cross-language contracts
    icon: "🔗"
    color: "#112233"
    priority: 100
    include: ["contracts/**"]
modules:
  roots:
    - pattern: "client/*"
      name: "mobile-$1"
`)
  assert.equal(config.title, 'Mobile change map')
  assert.equal(config.categoryById.contracts.label, 'Cross-language contracts')
  assert.equal(config.customCategoryRules[0].id, 'contracts')
  assert.deepEqual(config.modules.roots[0], { pattern: 'client/*', name: 'mobile-$1' })
})

test('rejects unknown configuration and unsafe markers', () => {
  assert.throws(() => parseConfigText('version: 1\nunknown: true\n'), /additional properties/)
  assert.throws(() => parseConfigText('version: 1\nmarker: "<!-- ok -->\\n<script>"\n'), /Invalid/)
  assert.throws(() => parseConfigText('version: 1\nvisualizations: {}\n'), /additional properties/)
  assert.throws(() => parseConfigText('version: 1\nviews: [files]\n'), /Invalid/)
})

test('rejects non-object configuration documents', () => {
  assert.throws(() => parseConfigText('- one\n- two\n'), /mapping\/object/)
  assert.throws(() => parseConfigText('{}\n'), /must have required property 'version'/)
})

test('configuration identity is stable across mapping key order', () => {
  const first = parseConfigText('version: 1\ntitle: Stable\npresets: [kotlin-gradle]\n')
  const second = parseConfigText('presets: [kotlin-gradle]\ntitle: Stable\nversion: 1\n')
  assert.equal(configurationDigest(first), configurationDigest(second))
  assert.match(configurationDigest(first), /^sha256:[a-f0-9]{64}$/)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const { analyzeChanges, classifyPath, extractModule } = require('../src/analyze.cjs')
const { normalizeConfig, parseConfigText } = require('../src/config.cjs')

const mixedFiles = [
  { filename: 'kotlin/core/src/commonMain/kotlin/dev/example/Core.kt', status: 'modified', additions: 20, deletions: 4 },
  { filename: 'kotlin/core/src/commonTest/kotlin/dev/example/CoreTest.kt', status: 'added', additions: 30, deletions: 0 },
  { filename: 'kotlin/mobile/src/androidMain/kotlin/dev/example/Android.kt', status: 'modified', additions: 9, deletions: 2 },
  { filename: 'kotlin/mobile/src/androidMain/AndroidManifest.xml', status: 'modified', additions: 1, deletions: 0 },
  { filename: 'java/server/src/main/java/dev/example/Server.java', status: 'modified', additions: 12, deletions: 3 },
  { filename: 'java/server/src/test/java/dev/example/ServerTest.java', status: 'modified', additions: 18, deletions: 1 },
  { filename: 'swift/Package.swift', status: 'modified', additions: 2, deletions: 2 },
  { filename: 'swift/Sources/LoginKit/Login.swift', status: 'added', additions: 25, deletions: 0 },
  { filename: 'swift/Tests/LoginKitTests/LoginTests.swift', status: 'added', additions: 15, deletions: 0 },
  {
    filename: 'kotlin/core/api/core.api', status: 'modified', additions: 2, deletions: 1,
    patch: '@@ -1 +1,2 @@\n-public final fun oldApi(): kotlin.Unit\n+public final fun newApi(): kotlin.Unit\n+public final class Added',
  },
  { filename: 'docs/architecture.md', status: 'modified', additions: 8, deletions: 2 },
  { filename: '.github/workflows/ci.yml', status: 'modified', additions: 5, deletions: 1 },
  { filename: 'gradle/libs.versions.toml', status: 'modified', additions: 1, deletions: 1 },
  { filename: 'build/generated/source/Foo.kt', status: 'added', additions: 100, deletions: 0 },
  { filename: 'experimental/Unknown.kt', status: 'added', additions: 3, deletions: 0 },
]

test('analyzes mixed Kotlin, Java, and Swift changes exactly once', () => {
  const profile = analyzeChanges({ files: mixedFiles, config: normalizeConfig(), context: { base: 'main', head: '1234567890abcdef' } })
  assert.equal(profile.totals.files, mixedFiles.length)
  assert.equal(profile.totals.additions, 251)
  assert.equal(profile.totals.deletions, 17)
  assert.deepEqual(profile.activePresets, ['generic', 'kotlin-gradle', 'java-gradle', 'swift-package'])
  assert.equal(profile.categories.find(category => category.id === 'production').stats.files, 5)
  assert.equal(profile.categories.find(category => category.id === 'test').stats.files, 3)
  assert.equal(profile.categories.find(category => category.id === 'api').stats.files, 1)
  assert.equal(profile.categories.find(category => category.id === 'generated').stats.files, 1)
  assert.equal(profile.categories.find(category => category.id === 'unclassified').stats.files, 1)
  assert.ok(profile.modules.some(module => module.id === 'kotlin/core'))
  assert.ok(profile.modules.some(module => module.id === 'java/server'))
  assert.ok(profile.modules.some(module => module.id === 'LoginKit'))
  assert.deepEqual(profile.platforms.map(platform => platform.label).sort(), ['Android', 'Common', 'JVM', 'Swift'])
  assert.equal(profile.api.additions.length, 2)
  assert.equal(profile.api.removals.length, 1)
  assert.equal(profile.warnings[0].id, 'unclassified-source')
  assert.equal(profile.files[0].provenance.category.confidence, 'inferred')
  assert.equal(profile.configuration.schemaVersion, 1)
  assert.match(profile.configuration.digest, /^sha256:[a-f0-9]{64}$/)
})

test('custom categories and module roots take precedence', () => {
  const config = parseConfigText(`
version: 1
categories:
  - id: contracts
    label: Contracts
    priority: 100
    include: ["client/*/contracts/**"]
modules:
  roots:
    - pattern: "client/*"
      name: "$1"
platforms:
  - id: apple-bridge
    label: Apple bridge
    include: ["client/*/contracts/*.swift"]
`)
  const path = 'client/wallet/contracts/Bridge.swift'
  assert.equal(classifyPath(path, config, ['generic', 'swift-package']).id, 'contracts')
  assert.equal(extractModule(path, config).id, 'wallet')
  const profile = analyzeChanges({ files: [{ filename: path, additions: 4, deletions: 0, status: 'added' }], config })
  assert.equal(profile.files[0].platform, 'Apple bridge')
  assert.equal(profile.files[0].provenance.module.confidence, 'configured')
})

test('classifies sample implementation, README, build files, and tests separately', () => {
  const config = normalizeConfig()
  const active = ['generic', 'kotlin-gradle']
  assert.equal(classifyPath('sample/app/src/commonMain/kotlin/App.kt', config, active).id, 'sample')
  assert.equal(classifyPath('sample/app/src/commonTest/kotlin/AppTest.kt', config, active).id, 'test')
  assert.equal(classifyPath('sample/app/build.gradle.kts', config, active).id, 'tooling')
  assert.equal(classifyPath('sample/app/README.md', config, active).id, 'docs')
  assert.equal(classifyPath('documentation/examples/src/commonMain/kotlin/Example.kt', config, active).id, 'docs_examples')
  assert.equal(classifyPath('client/platform/src/androidMain/AndroidManifest.xml', config, active).id, 'production')
})

test('computes configured direct and transitive dependency impact', () => {
  const config = parseConfigText(`
version: 1
presets: [java-gradle]
dependencyGraph:
  edges:
    - { from: app, to: core }
    - { from: ui, to: app }
`)
  const profile = analyzeChanges({ files: [{ filename: 'core/src/main/java/Core.java', additions: 5, deletions: 0, status: 'modified' }], config })
  assert.deepEqual(profile.dependencyImpact.changed, ['core'])
  assert.deepEqual(profile.dependencyImpact.impacted, ['app', 'ui'])
  assert.equal(profile.dependencyImpact.nodes.find(node => node.id === 'app').distance, 1)
  assert.equal(profile.dependencyImpact.nodes.find(node => node.id === 'ui').distance, 2)
})

test('keeps changed modules that are not mentioned by a dependency edge', () => {
  const config = parseConfigText(`
version: 1
presets: [java-gradle]
dependencyGraph:
  edges:
    - { from: app, to: core }
`)
  const profile = analyzeChanges({ files: [{ filename: 'standalone/src/main/java/A.java', additions: 1, deletions: 0 }], config })
  assert.deepEqual(profile.dependencyImpact.changed, ['standalone'])
  assert.equal(profile.dependencyImpact.nodes.find(node => node.id === 'standalone').state, 'changed')
})

test('combines explicit and auto-detected presets without treating Kotlin Gradle as Java', () => {
  const config = parseConfigText('version: 1\npresets: [auto, swift-package]\n')
  const profile = analyzeChanges({ files: [{ filename: 'build.gradle.kts', additions: 1, deletions: 0 }], config })
  assert.deepEqual(profile.activePresets, ['generic', 'swift-package', 'kotlin-gradle'])
})

test('enforces GitHub totals when the file list is complete', () => {
  assert.throws(() => analyzeChanges({
    files: [{ filename: 'src/main/java/A.java', additions: 1, deletions: 0 }],
    config: normalizeConfig(),
    expected: { files: 2, additions: 1, deletions: 0 },
  }), /GitHub invariant failed for files/)
})

test('warns instead of enforcing totals for incomplete GitHub data', () => {
  const profile = analyzeChanges({
    files: [{ filename: 'src/main/java/A.java', additions: 1, deletions: 0 }],
    config: normalizeConfig(),
    expected: { files: 2, additions: 99, deletions: 99 },
    incomplete: true,
  })
  assert.equal(profile.warnings[0].id, 'incomplete-files')
})

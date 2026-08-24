const { matchesAny, matchesSelector, moduleRootMatch } = require('./match.cjs')
const {
  detectPresets,
  languageForPath,
  sourceSetForPath,
  platformForSourceSet,
} = require('./presets.cjs')
const { STATUS_ORDER } = require('./constants.cjs')
const { analyzeApiPatches } = require('./api-diff.cjs')
const { analyzeDependencyImpact } = require('./dependencies.cjs')
const { configurationDigest } = require('./config.cjs')

function emptyStats() {
  return {
    files: 0,
    additions: 0,
    deletions: 0,
    churn: 0,
    binaryFiles: 0,
    statuses: Object.fromEntries(STATUS_ORDER.map(status => [status, 0])),
  }
}

function normalizeStatus(status) {
  if (!status) return 'unknown'
  const normalized = String(status).toLowerCase()
  if (normalized === 'deleted') return 'removed'
  return STATUS_ORDER.includes(normalized) ? normalized : 'unknown'
}

function normalizeFile(file) {
  const path = file.filename || file.path
  if (!path || typeof path !== 'string') throw new Error('Every changed file requires a filename/path')
  const additions = Number(file.additions) || 0
  const deletions = Number(file.deletions) || 0
  const patch = typeof file.patch === 'string' ? file.patch : null
  const binaryExtension = /\.(?:png|jpe?g|gif|webp|avif|ico|pdf|zip|gz|tgz|jar|klib|a|so|dylib|framework|xcframework|woff2?|ttf|otf|mp3|mp4|mov)$/i.test(path)
  return {
    path,
    previousPath: file.previous_filename || file.previousPath || null,
    status: normalizeStatus(file.status),
    additions,
    deletions,
    churn: additions + deletions,
    patch,
    binary: file.binary === true || (file.binary !== false && binaryExtension),
  }
}

function addStats(target, file) {
  target.files += 1
  target.additions += file.additions
  target.deletions += file.deletions
  target.churn += file.churn
  if (file.binary) target.binaryFiles += 1
  target.statuses[file.status] = (target.statuses[file.status] || 0) + 1
}

function categoryAggregate(definition) {
  return {
    id: definition.id,
    label: definition.label,
    icon: definition.icon || '',
    color: definition.color || '#94A3B8',
    order: definition.order || 0,
    stats: emptyStats(),
  }
}

function isSourceLike(path, config) {
  return config.sourceExtensions.some(extension => path.toLowerCase().endsWith(extension.toLowerCase()))
}

function isTestPath(path) {
  return /(?:^|\/)(?:Tests?|testFixtures|[^/]*Test|__tests__)(?:\/|$)/i.test(path)
    || /\/src\/[^/]*(?:Test|Benchmark)(?:\/|$)/i.test(path)
}

function isProductionPath(path, activePresets) {
  if (activePresets.some(preset => preset === 'kotlin-gradle' || preset === 'java-gradle' || preset === 'java-maven')) {
    if (/\/src\/(?:main|[^/]*Main)(?:\/|$)/.test(path) || /^src\/(?:main|[^/]*Main)(?:\/|$)/.test(path)) return true
  }
  if (activePresets.includes('swift-package') && /(?:^|\/)Sources\/[^/]+(?:\/|$)/.test(path)) return true
  return /(?:^|\/)(?:src|lib)\/(?!test(?:\/|$))/.test(path)
}

function isApiBaseline(path) {
  return /(?:^|\/)api\/.*(?:\.api|\.klib\.api)$/.test(path)
    || /(?:^|\/)(?:api|abi)-dump(?:\/|$)/.test(path)
}

function isDocumentation(path) {
  const basename = path.split('/').at(-1)
  return /^(?:README|CONTRIBUTING|SECURITY|CHANGELOG|CODE_OF_CONDUCT)(?:\.[^.]+)?$/i.test(basename)
    || /^(?:LICENSE|NOTICE)(?:\.[^.]+)?$/i.test(basename)
    || /(?:^|\/)(?:docs?|documentation|spec-notes)(?:\/|$)/.test(path)
    || /\.(?:md|mdx|adoc|rst)$/i.test(path)
}

function isTooling(path) {
  const basename = path.split('/').at(-1)
  return /(?:^|\/)(?:\.github|\.githooks|tools|scripts|build-logic|config)(?:\/|$)/.test(path)
    || /^(?:settings|build)\.gradle(?:\.kts)?$/.test(basename)
    || /^(?:gradlew|gradlew\.bat|gradle\.properties|Makefile|Dockerfile)$/.test(basename)
    || /\.(?:xcodeproj|xcworkspace)\//.test(path)
}

function isDependencyMetadata(path) {
  const basename = path.split('/').at(-1)
  return /^(?:pom\.xml|Package\.swift|Package\.resolved|libs\.versions\.toml|verification-metadata\.xml)$/.test(basename)
    || /(?:^|\/)gradle\/dependency-locks(?:\/|$)/.test(path)
    || /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|Podfile\.lock)$/.test(path)
}

function isSamplePath(path) {
  const match = path.match(/(?:^|\/)(?:sample|samples|example|examples|demo|demos)(?:\/|$)/i)
  if (!match) return false
  const sourceRoots = ['/src/', '/Sources/', '/Tests/']
    .map(root => path.indexOf(root))
    .filter(index => index >= 0)
  return sourceRoots.length === 0 || match.index < Math.min(...sourceRoots)
}

function classifyPath(path, config, activePresets) {
  for (const category of config.customCategoryRules) {
    if (matchesSelector(path, category)) {
      return { id: category.id, source: `config:category:${category.id}`, confidence: 'configured' }
    }
  }
  if (matchesSelector(path, config.generated)) return { id: 'generated', source: 'config:generated', confidence: 'configured' }
  if (isApiBaseline(path)) return { id: 'api', source: 'preset:api-baseline', confidence: 'exact-path' }
  if (isTestPath(path)) return { id: 'test', source: 'preset:test-layout', confidence: 'inferred' }
  if (isDependencyMetadata(path)) return { id: 'dependencies', source: 'preset:dependency-metadata', confidence: 'exact-path' }
  if (isTooling(path)) return { id: 'tooling', source: 'preset:repository-tooling', confidence: 'inferred' }
  if (/(?:^|\/)documentation\/examples(?:\/|$)/.test(path)) {
    return { id: 'docs_examples', source: 'preset:documentation-example', confidence: 'inferred' }
  }
  if (isDocumentation(path)) return { id: 'docs', source: 'preset:documentation', confidence: 'inferred' }
  if (isSamplePath(path)) {
    return { id: 'sample', source: 'preset:sample-layout', confidence: 'inferred' }
  }
  // Production roots also contain runtime resources and manifests, not only source-language files.
  if (isProductionPath(path, activePresets)) {
    return { id: 'production', source: `preset:${activePresets.join('+')}`, confidence: 'inferred' }
  }
  if (isSourceLike(path, config)) return { id: 'unclassified', source: 'fallback:source-extension', confidence: 'unknown' }
  return { id: 'other', source: 'fallback:other', confidence: 'unknown' }
}

function extractModule(path, config) {
  for (const definition of config.modules.roots) {
    const match = moduleRootMatch(path, definition)
    if (match) return { id: match, source: 'config:module-root', confidence: 'configured' }
  }
  if (config.modules.roots.length > 0 && config.modules.fallback === false) return null

  const swift = path.match(/(?:^|\/)(?:Sources|Tests)\/([^/]+)(?:\/|$)/)
  if (swift) return { id: swift[1], source: 'preset:swift-package-target', confidence: 'inferred' }

  const sourceIndex = path.indexOf('/src/')
  if (sourceIndex > 0) {
    return { id: path.slice(0, sourceIndex), source: 'preset:source-root', confidence: 'inferred' }
  }
  if (path.startsWith('src/')) return { id: 'root', source: 'preset:source-root', confidence: 'inferred' }

  const apiIndex = path.indexOf('/api/')
  if (apiIndex > 0) return { id: path.slice(0, apiIndex), source: 'preset:api-root', confidence: 'inferred' }
  return null
}

function extractPlatform(path, config, language) {
  for (const platform of config.platforms) {
    if (matchesSelector(path, platform)) {
      return { id: platform.id, label: platform.label, source: `config:platform:${platform.id}`, confidence: 'configured' }
    }
  }
  const sourceSet = sourceSetForPath(path)
  const platform = platformForSourceSet(sourceSet)
  if (platform) return { id: platform.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'), label: platform, source: 'preset:source-set', confidence: 'inferred' }
  if (language === 'Swift') return { id: 'swift', label: 'Swift', source: 'preset:language', confidence: 'inferred' }
  if (language === 'Java') return { id: 'jvm', label: 'JVM', source: 'preset:language', confidence: 'inferred' }
  return null
}

function analyzeChanges({ files, config, context = {}, expected = null, incomplete = false }) {
  const normalized = files.map(normalizeFile)
  const activePresets = detectPresets(files, config.presets)
  const categories = new Map(config.categoryDefinitions.map(category => [category.id, categoryAggregate(category)]))
  const modules = new Map()
  const platforms = new Map()
  const languages = new Map()
  const totals = emptyStats()

  const classifiedFiles = normalized.map(file => {
    const category = classifyPath(file.path, config, activePresets)
    const language = languageForPath(file.path)
    const module = extractModule(file.path, config)
    const platform = extractPlatform(file.path, config, language)
    const classified = { ...file, category: category.id, module: module?.id || null, platform: platform?.label || null, language, provenance: { category, module, platform } }

    if (!categories.has(category.id)) {
      categories.set(category.id, { id: category.id, label: category.id, icon: '', color: '#94A3B8', order: 0, stats: emptyStats() })
    }
    addStats(categories.get(category.id).stats, classified)
    addStats(totals, classified)

    if (module && !['sample', 'docs', 'tooling', 'dependencies', 'generated', 'unclassified', 'other'].includes(category.id)) {
      if (!modules.has(module.id)) modules.set(module.id, { id: module.id, categories: {}, total: emptyStats(), provenance: module })
      const entry = modules.get(module.id)
      if (!entry.categories[category.id]) entry.categories[category.id] = emptyStats()
      addStats(entry.categories[category.id], classified)
      addStats(entry.total, classified)
    }

    if (platform && !['sample', 'docs', 'tooling', 'dependencies', 'generated', 'unclassified', 'other'].includes(category.id)) {
      if (!platforms.has(platform.id)) platforms.set(platform.id, { id: platform.id, label: platform.label, stats: emptyStats(), categories: {}, provenance: platform })
      const entry = platforms.get(platform.id)
      if (!entry.categories[category.id]) entry.categories[category.id] = emptyStats()
      addStats(entry.categories[category.id], classified)
      addStats(entry.stats, classified)
    }

    if (language) {
      if (!languages.has(language)) languages.set(language, emptyStats())
      addStats(languages.get(language), classified)
    }
    return classified
  })

  const warnings = []
  if (incomplete) warnings.push({ id: 'incomplete-files', message: 'GitHub returned fewer file records than the pull request reports. Statistics are incomplete.' })
  const unclassified = classifiedFiles.filter(file => file.category === 'unclassified')
  if (unclassified.length > 0) warnings.push({ id: 'unclassified-source', message: `${unclassified.length} source-like file${unclassified.length === 1 ? '' : 's'} did not match a known layout.` })

  if (!incomplete && expected) {
    for (const [field, actual] of [['files', totals.files], ['additions', totals.additions], ['deletions', totals.deletions]]) {
      if (Number.isFinite(expected[field]) && expected[field] !== actual) {
        throw new Error(`GitHub invariant failed for ${field}: breakdown=${actual}, pull-request=${expected[field]}`)
      }
    }
  }

  const categoryList = [...categories.values()]
    .filter(category => category.stats.files > 0)
    .sort((left, right) => (left.order || 0) - (right.order || 0) || left.id.localeCompare(right.id))
  const moduleList = [...modules.values()].sort((left, right) => right.total.churn - left.total.churn || left.id.localeCompare(right.id))
  const platformList = [...platforms.values()].sort((left, right) => right.stats.churn - left.stats.churn || left.label.localeCompare(right.label))
  const languageList = [...languages.entries()].map(([language, stats]) => ({ language, stats })).sort((left, right) => right.stats.churn - left.stats.churn || left.language.localeCompare(right.language))
  const api = analyzeApiPatches(classifiedFiles)
  const dependencyImpact = analyzeDependencyImpact(moduleList, config.dependencyGraph.edges)

  return {
    schemaVersion: 1,
    context: {
      repository: context.repository || null,
      pullRequest: context.pullRequest || null,
      base: context.base || null,
      head: context.head || null,
      generatedAt: context.generatedAt || new Date().toISOString(),
    },
    configuration: {
      schemaVersion: config.version,
      source: context.configuration?.source || null,
      ref: context.configuration?.ref || null,
      digest: configurationDigest(config),
    },
    activePresets,
    totals,
    categories: categoryList,
    modules: moduleList,
    platforms: platformList,
    languages: languageList,
    files: classifiedFiles,
    api,
    dependencyImpact,
    warnings,
    incomplete,
  }
}

module.exports = {
  emptyStats,
  categoryAggregate,
  normalizeFile,
  classifyPath,
  extractModule,
  extractPlatform,
  analyzeChanges,
}

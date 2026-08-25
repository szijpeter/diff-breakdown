const {
  formatNumber,
  formatPercent,
  escapeMarkdownTable,
  inlineCode,
  mermaidText,
  intensity,
  textBar,
} = require('./render-utils.cjs')

function categoryTable(profile) {
  const totalChurn = profile.totals.churn
  const rows = [
    '| Category | Files | 🟢 Added | 🔴 Deleted | 📊 Change share |',
    '|---|---:|---:|---:|---|',
  ]
  for (const category of profile.categories) {
    rows.push(`| ${category.icon || ''} ${escapeMarkdownTable(category.label)} | ${formatNumber(category.stats.files)} | **+${formatNumber(category.stats.additions)}** | **−${formatNumber(category.stats.deletions)}** | \`${textBar(category.stats.churn, totalChurn)}\` ${formatPercent(category.stats.churn, totalChurn)} |`)
  }
  return rows.join('\n')
}

function countNoun(value, singular, plural = `${singular}s`) {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`
}

function headline(profile) {
  const metrics = [
    `**${countNoun(profile.totals.files, 'file')}**`,
    `🟢 **+${formatNumber(profile.totals.additions)} added**`,
    `🔴 **−${formatNumber(profile.totals.deletions)} deleted**`,
  ]
  if (profile.modules.length > 0) metrics.push(`**${countNoun(profile.modules.length, 'module')}**`)
  if (profile.platforms.length > 0) metrics.push(`**${countNoun(profile.platforms.length, 'platform')}**`)
  if (profile.dependencyImpact.available && profile.dependencyImpact.impacted.length > 0) {
    metrics.push(`**${countNoun(profile.dependencyImpact.impacted.length, 'potential dependent')}**`)
  }
  return metrics.join(' · ')
}

function compositionDiagram(profile) {
  const categories = profile.categories.filter(category => category.stats.churn > 0)
  if (categories.length < 2) return ''
  const lines = ['```mermaid', 'pie showData', '    title Change composition by churn']
  for (const category of categories) {
    lines.push(`    "${mermaidText(category.label)}" : ${category.stats.churn}`)
  }
  lines.push('```')
  return lines.join('\n')
}

function statusSection(profile) {
  const statuses = Object.entries(profile.totals.statuses).filter(([, count]) => count > 0)
  if (statuses.length === 0) return ''
  const summary = statuses.map(([status, count]) => `${formatNumber(count)} ${status}`).join(', ')
  const rows = [
    '<details>',
    `<summary>Change form — ${summary}</summary>`,
    '',
    '| Status | Files |',
    '|---|---:|',
    ...statuses.map(([status, count]) => `| ${status[0].toUpperCase()}${status.slice(1)} | ${formatNumber(count)} |`),
    '',
    `Additions and removals are shown separately above; churn is descriptive and is not a coverage or risk score.`,
    '',
    '</details>',
  ]
  return rows.join('\n')
}

function moduleSection(profile, config) {
  const modules = profile.modules.slice(0, config.limits.commentModules)
  if (modules.length === 0) return ''
  const preferred = ['production', 'test', 'api', 'docs_examples']
  const categoryIds = [
    ...preferred,
    ...config.categoryDefinitions.map(category => category.id).filter(id => !preferred.includes(id)),
  ].filter(id => modules.some(module => (module.categories[id]?.churn || 0) > 0)).slice(0, 8)
  const labels = Object.fromEntries(config.categoryDefinitions.map(category => [category.id, category.label]))
  const maxima = Object.fromEntries(categoryIds.map(id => [id, Math.max(...modules.map(module => module.categories[id]?.churn || 0))]))
  const rows = [
    '<details open>',
    `<summary>Module change matrix — ${countNoun(profile.modules.length, 'changed module')}</summary>`,
    '',
    `| Module | ${categoryIds.map(id => escapeMarkdownTable(labels[id] || id)).join(' | ')} | Total |`,
    `|---|${categoryIds.map(() => '---:').join('|')}|---:|`,
  ]
  for (const module of modules) {
    const cells = categoryIds.map(id => {
      const value = module.categories[id]?.churn || 0
      return value === 0 ? '·' : `${intensity(value, maxima[id])} ${formatNumber(value)}`
    })
    rows.push(`| ${inlineCode(module.id)} | ${cells.join(' | ')} | **${formatNumber(module.total.churn)}** |`)
  }
  if (profile.modules.length > modules.length) {
    rows.push(`| …${profile.modules.length - modules.length} more | ${categoryIds.map(() => '').join(' | ')} | |`)
  }
  rows.push('', 'Intensity is relative within each column: `░` low, `▒` medium, `▓` high, `█` highest.', '', '</details>')
  return rows.join('\n')
}

function platformSection(profile) {
  if (profile.platforms.length === 0) return ''
  const totalChurn = profile.platforms.reduce((total, platform) => total + platform.stats.churn, 0)
  const rows = [
    '<details>',
    `<summary>Platform distribution — ${countNoun(profile.platforms.length, 'platform')}</summary>`,
    '',
    '| Platform | Files | Production | Tests | Other | 📊 Change share |',
    '|---|---:|---:|---:|---:|---|',
  ]
  for (const platform of profile.platforms) {
    const production = platform.categories.production?.churn || 0
    const tests = platform.categories.test?.churn || 0
    const other = platform.stats.churn - production - tests
    rows.push(`| ${escapeMarkdownTable(platform.label)} | ${formatNumber(platform.stats.files)} | ${formatNumber(production)} | ${formatNumber(tests)} | ${formatNumber(other)} | \`${textBar(platform.stats.churn, totalChurn)}\` ${formatPercent(platform.stats.churn, totalChurn)} |`)
  }
  rows.push('', '</details>')
  return rows.join('\n')
}

function apiSection(profile, config) {
  const apiCategory = profile.categories.find(category => category.id === 'api')
  if (!apiCategory) return ''
  const additions = profile.api.additions.slice(0, config.limits.commentSymbols)
  const removals = profile.api.removals.slice(0, config.limits.commentSymbols)
  const rows = [
    '<details>',
    `<summary>Public API baseline — ${countNoun(profile.api.additions.length, 'visible addition')}, ${countNoun(profile.api.removals.length, 'visible removal')}</summary>`,
    '',
    `- Baseline files: **${formatNumber(apiCategory.stats.files)}**`,
    `- Text additions / removals: **+${formatNumber(apiCategory.stats.additions)} / -${formatNumber(apiCategory.stats.deletions)}**`,
    `- Visible declaration-like additions / removals: **${formatNumber(profile.api.additions.length)} / ${formatNumber(profile.api.removals.length)}**`,
  ]
  if (profile.api.filesWithoutPatch > 0) rows.push(`- ⚠️ ${profile.api.filesWithoutPatch} API file patch${profile.api.filesWithoutPatch === 1 ? ' was' : 'es were'} unavailable; symbol details are partial.`)
  if (additions.length > 0) rows.push('', '**Added declarations**', '', ...additions.map(change => `- ${inlineCode(change.symbol)} — ${inlineCode(change.file)}`))
  if (removals.length > 0) rows.push('', '**Removed declarations**', '', ...removals.map(change => `- ${inlineCode(change.symbol)} — ${inlineCode(change.file)}`))
  rows.push('', '> Declaration extraction is a textual baseline view, not a language compatibility verdict.', '', '</details>')
  return rows.join('\n')
}

function dependencySection(profile) {
  const impact = profile.dependencyImpact
  if (!impact.available) return ''
  return [
    '<details>',
    `<summary>Dependency reach — ${countNoun(impact.impacted.length, 'potential dependent')}</summary>`,
    '',
    `- Changed graph modules: ${impact.changed.length > 0 ? impact.changed.map(inlineCode).join(', ') : 'none'}`,
    `- Potentially impacted dependents: ${impact.impacted.length > 0 ? impact.impacted.map(inlineCode).join(', ') : 'none'}`,
    '',
    '> Impact follows configured module edges. It identifies structural reach, not runtime behavior.',
    '',
    '</details>',
  ].join('\n')
}

function visualizationSection(profile) {
  const diagram = compositionDiagram(profile)
  if (!diagram) return ''
  return [
    '<details>',
    '<summary>Visualizations — change composition</summary>',
    '',
    diagram,
    '',
    '</details>',
  ].join('\n')
}

function warningSection(profile, config) {
  if (profile.warnings.length === 0) return ''
  const unclassified = profile.files.filter(file => file.category === 'unclassified').slice(0, config.limits.commentFiles)
  const lines = ['> [!WARNING]', ...profile.warnings.map(warning => `> ${escapeMarkdownTable(warning.message)}`)]
  if (unclassified.length > 0) {
    lines.push('', '<details>', '<summary>Unclassified source files</summary>', '', ...unclassified.map(file => `- ${inlineCode(file.path)}`))
    const remaining = profile.files.filter(file => file.category === 'unclassified').length - unclassified.length
    if (remaining > 0) lines.push(`- …and ${remaining} more`)
    lines.push('', '</details>')
  }
  return lines.join('\n')
}

function renderMarkdown(profile, config, { includeMarker = true } = {}) {
  const views = new Set(config.views)
  const lines = []
  if (includeMarker) lines.push(config.marker, '')
  lines.push(`## 📊 ${escapeMarkdownTable(config.title)}`, '')
  const comparison = []
  if (profile.context.base) comparison.push(`base ${inlineCode(profile.context.base)}`)
  if (profile.context.head) comparison.push(`head ${inlineCode(profile.context.head.slice(0, 12))}`)
  if (comparison.length > 0) lines.push(`<sub>${comparison.join(' · ')}</sub>`, '')

  lines.push(headline(profile), '')

  const warnings = warningSection(profile, config)
  if (warnings) lines.push(warnings, '')
  if (views.has('composition')) {
    lines.push(categoryTable(profile), '')
  }
  if (views.has('status')) {
    const section = statusSection(profile)
    if (section) lines.push(section, '')
  }
  if (views.has('modules')) {
    const section = moduleSection(profile, config)
    if (section) lines.push(section, '')
  }
  if (views.has('platforms')) {
    const section = platformSection(profile)
    if (section) lines.push(section, '')
  }
  if (views.has('api')) {
    const section = apiSection(profile, config)
    if (section) lines.push(section, '')
  }
  if (views.has('dependencies')) {
    const section = dependencySection(profile)
    if (section) lines.push(section, '')
  }
  if (views.has('composition')) {
    const section = visualizationSection(profile)
    if (section) lines.push(section, '')
  }

  lines.push(
    '<details>',
    '<summary>Method and provenance</summary>',
    '',
    `- Active presets: ${profile.activePresets.map(inlineCode).join(', ')}`,
    `- Configuration: ${profile.configuration.source ? inlineCode(profile.configuration.source) : 'unspecified'}${profile.configuration.ref ? ` at ${inlineCode(profile.configuration.ref)}` : ''} · ${inlineCode(`sha256:${profile.configuration.digest.replace(/^sha256:/, '').slice(0, 12)}`)}`,
    '- Every changed file returned by GitHub is represented exactly once in the category totals.',
    '- Category, module, and platform facts retain configured or inferred provenance during analysis.',
    '- Change volume is descriptive; it is not test coverage, code quality, or risk.',
    '',
    '</details>',
  )
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

module.exports = { renderMarkdown }

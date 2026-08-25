function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatPercent(part, total) {
  if (total === 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeMarkdownTable(value) {
  return escapeHtml(value).replaceAll('|', '&#124;').replace(/[\r\n]+/g, ' ')
}

function inlineCode(value) {
  return `<code>${escapeMarkdownTable(value)}</code>`
}

function mermaidText(value) {
  return String(value)
    .replace(/["`\\\r\n]/g, ' ')
    .replace(/[^\p{L}\p{N} ._+\-/]/gu, '')
    .trim()
    .slice(0, 80)
}

function intensity(value, maximum) {
  if (value <= 0 || maximum <= 0) return '·'
  const ratio = value / maximum
  if (ratio <= 0.25) return '░'
  if (ratio <= 0.5) return '▒'
  if (ratio <= 0.75) return '▓'
  return '█'
}

function textBar(value, maximum, width = 10) {
  if (maximum <= 0) return '░'.repeat(width)
  const fractionalBlocks = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
  const units = value === 0 ? 0 : Math.max(1, Math.round((value / maximum) * width * 8))
  const bounded = Math.min(width * 8, units)
  const filled = Math.floor(bounded / 8)
  const remainder = bounded % 8
  const partial = fractionalBlocks[remainder]
  const empty = width - filled - (partial ? 1 : 0)
  return `${'█'.repeat(filled)}${partial}${'░'.repeat(Math.max(0, empty))}`
}

module.exports = {
  formatNumber,
  formatPercent,
  escapeHtml,
  escapeMarkdownTable,
  inlineCode,
  mermaidText,
  intensity,
  textBar,
}

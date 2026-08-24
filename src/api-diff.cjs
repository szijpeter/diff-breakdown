function isSymbolLine(value) {
  const line = value.trim()
  if (!line || line === '{' || line === '}' || line.startsWith('//')) return false
  return /\b(?:public|protected|open|abstract|final|class|interface|protocol|struct|enum|typealias|fun|func|var|val|init|constructor)\b/.test(line)
}

function cleanSymbol(value) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 240)
}

function analyzeApiPatches(files) {
  const additions = []
  const removals = []
  let missingPatches = 0

  for (const file of files.filter(candidate => candidate.category === 'api')) {
    if (!file.patch) {
      missingPatches += 1
      continue
    }
    for (const line of file.patch.split('\n')) {
      if (line.startsWith('+++') || line.startsWith('---')) continue
      if (line.startsWith('+') && isSymbolLine(line.slice(1))) {
        additions.push({ file: file.path, symbol: cleanSymbol(line.slice(1)) })
      } else if (line.startsWith('-') && isSymbolLine(line.slice(1))) {
        removals.push({ file: file.path, symbol: cleanSymbol(line.slice(1)) })
      }
    }
  }

  return {
    additions,
    removals,
    filesWithoutPatch: missingPatches,
    provenance: 'textual API-baseline patch',
    confidence: missingPatches === 0 ? 'exact-for-visible-patches' : 'partial',
  }
}

module.exports = { analyzeApiPatches }

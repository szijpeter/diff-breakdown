const picomatch = require('picomatch')

const MATCH_OPTIONS = { dot: true, nocase: false }

function matchesAny(path, patterns = []) {
  return patterns.some(pattern => picomatch.isMatch(path, pattern, MATCH_OPTIONS))
}

function matchesSelector(path, selector = {}) {
  const include = selector.include || []
  const exclude = selector.exclude || []
  return include.length > 0 && matchesAny(path, include) && !matchesAny(path, exclude)
}

function moduleRootMatch(path, definition) {
  const rule = typeof definition === 'string' ? { pattern: definition } : definition
  const patternParts = rule.pattern.replace(/\/$/, '').split('/')
  const pathParts = path.split('/')
  if (pathParts.length < patternParts.length) return null

  const captures = []
  const resolved = []
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index]
    const pathPart = pathParts[index]
    if (patternPart === '*') {
      captures.push(pathPart)
      resolved.push(pathPart)
      continue
    }
    if (patternPart !== pathPart) return null
    resolved.push(pathPart)
  }

  let name = rule.name || resolved.join('/')
  captures.forEach((capture, index) => {
    name = name.replaceAll(`$${index + 1}`, capture)
  })
  return name
}

module.exports = { matchesAny, matchesSelector, moduleRootMatch }

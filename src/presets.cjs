const PRESET_IDS = ['generic', 'kotlin-gradle', 'java-gradle', 'java-maven', 'swift-package']

function detectPresets(files, requested = ['auto']) {
  const explicit = requested.filter(preset => preset !== 'auto' && PRESET_IDS.includes(preset))
  if (!requested.includes('auto')) return [...new Set(['generic', ...explicit])]

  const paths = files.map(file => file.filename || file.path || '')
  const detected = ['generic', ...explicit]
  if (paths.some(path => path.endsWith('.kt') || path.endsWith('.kts') || /(?:^|\/)gradlew$/.test(path))) {
    detected.push('kotlin-gradle')
  }
  if (paths.some(path => path.endsWith('.java') || /(?:^|\/)src\/(?:main|test)\/java(?:\/|$)/.test(path))) {
    detected.push('java-gradle')
  }
  if (paths.some(path => /(?:^|\/)pom\.xml$/.test(path))) detected.push('java-maven')
  if (paths.some(path => path.endsWith('.swift') || /(?:^|\/)Package\.swift$/.test(path))) {
    detected.push('swift-package')
  }
  return [...new Set(detected.filter(preset => PRESET_IDS.includes(preset)))]
}

function languageForPath(path) {
  const extension = path.includes('.') ? `.${path.split('.').at(-1).toLowerCase()}` : ''
  const languages = {
    '.kt': 'Kotlin', '.kts': 'Kotlin', '.java': 'Java', '.swift': 'Swift',
    '.scala': 'Scala', '.groovy': 'Groovy', '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.c': 'C', '.h': 'C / C++', '.hpp': 'C / C++', '.cc': 'C++', '.cpp': 'C++',
    '.m': 'Objective-C', '.mm': 'Objective-C++', '.rs': 'Rust', '.go': 'Go',
    '.py': 'Python', '.rb': 'Ruby', '.php': 'PHP', '.cs': 'C#', '.fs': 'F#',
    '.sql': 'SQL', '.sq': 'SQL', '.proto': 'Protocol Buffers',
  }
  return languages[extension] || null
}

function sourceSetForPath(path) {
  const gradle = path.match(/(?:^|\/)src\/([^/]+)(?:\/|$)/)
  if (gradle) return gradle[1]
  const swift = path.match(/(?:^|\/)(Sources|Tests)\/([^/]+)(?:\/|$)/)
  if (swift) return swift[1] === 'Tests' ? 'swiftTest' : 'swiftMain'
  return null
}

function platformForSourceSet(sourceSet) {
  if (!sourceSet) return null
  if (sourceSet === 'commonMain' || sourceSet === 'commonTest') return 'Common'
  if (sourceSet === 'main' || sourceSet === 'test' || sourceSet === 'jvmMain' || sourceSet === 'jvmTest') return 'JVM'
  if (/android/i.test(sourceSet)) return 'Android'
  if (/^(?:ios|apple|macos|tvos|watchos)/i.test(sourceSet)) return 'Apple'
  if (/^(?:js|wasmJs)/i.test(sourceSet)) return 'Web'
  if (/^(?:linux|mingw|native)/i.test(sourceSet)) return 'Native'
  if (sourceSet === 'swiftMain' || sourceSet === 'swiftTest') return 'Swift'
  return sourceSet
}

module.exports = {
  PRESET_IDS,
  detectPresets,
  languageForPath,
  sourceSetForPath,
  platformForSourceSet,
}

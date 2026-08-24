const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const candidate = path.join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(candidate) : candidate.endsWith('.cjs') ? [candidate] : []
  })
}

for (const file of [...filesUnder(path.join(__dirname, '..', 'src')), ...filesUnder(path.join(__dirname, '..', 'tools'))]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' })
}

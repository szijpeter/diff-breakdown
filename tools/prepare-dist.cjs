const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const dist = path.resolve(projectRoot, 'dist')
if (path.dirname(dist) !== projectRoot || path.basename(dist) !== 'dist') {
  throw new Error(`Refusing to clean unexpected build directory: ${dist}`)
}
fs.rmSync(dist, { recursive: true, force: true })

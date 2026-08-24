const { createHash } = require('node:crypto')
const Ajv2020 = require('ajv/dist/2020')
const YAML = require('yaml')
const schema = require('../diff-breakdown.schema.json')
const { CATEGORY_DEFINITIONS, DEFAULT_CONFIG } = require('./constants.cjs')

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validate = ajv.compile(schema)

function structuredClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function parseConfigText(text, source = 'configuration') {
  let parsed
  try {
    parsed = YAML.parse(text)
  } catch (error) {
    throw new Error(`Could not parse ${source}: ${error.message}`)
  }
  if (parsed === null || parsed === undefined) parsed = {}
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${source} must contain a mapping/object at the top level`)
  }
  if (!validate(parsed)) {
    const details = validate.errors
      .map(error => `${error.instancePath || '/'} ${error.message}`)
      .join('; ')
    throw new Error(`Invalid ${source}: ${details}`)
  }
  return normalizeConfig(parsed)
}

function normalizeConfig(raw = {}) {
  const defaults = structuredClone(DEFAULT_CONFIG)
  const config = {
    ...defaults,
    ...raw,
    generated: { ...defaults.generated, ...(raw.generated || {}) },
    modules: { ...defaults.modules, ...(raw.modules || {}) },
    dependencyGraph: { ...defaults.dependencyGraph, ...(raw.dependencyGraph || {}) },
    limits: { ...defaults.limits, ...(raw.limits || {}) },
  }

  const categories = new Map(CATEGORY_DEFINITIONS.map(category => [category.id, { ...category }]))
  for (const category of raw.categories || []) {
    categories.set(category.id, { ...(categories.get(category.id) || {}), ...category })
  }
  config.categoryDefinitions = [...categories.values()].sort((left, right) =>
    (left.order || 0) - (right.order || 0) || left.id.localeCompare(right.id),
  )
  config.categoryById = Object.fromEntries(config.categoryDefinitions.map(category => [category.id, category]))
  config.customCategoryRules = (raw.categories || [])
    .filter(category => (category.include || []).length > 0)
    .sort((left, right) => (right.priority || 0) - (left.priority || 0))
  return config
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function configurationDigest(config) {
  const snapshot = Object.fromEntries(Object.entries(config)
    .filter(([key]) => !['categoryById', 'customCategoryRules'].includes(key)))
  return `sha256:${createHash('sha256').update(canonicalJson(snapshot)).digest('hex')}`
}

module.exports = {
  parseConfigText,
  normalizeConfig,
  configurationDigest,
}

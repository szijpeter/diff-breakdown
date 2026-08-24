const CATEGORY_DEFINITIONS = [
  { id: 'production', label: 'Production source', icon: '📦', color: '#6D5DFB', order: 10 },
  { id: 'test', label: 'Tests / verification', icon: '🧪', color: '#23A55A', order: 20 },
  { id: 'sample', label: 'Samples / demos', icon: '🧭', color: '#F59E0B', order: 30 },
  { id: 'docs_examples', label: 'Documentation examples', icon: '📖', color: '#EC4899', order: 40 },
  { id: 'docs', label: 'Documentation / specifications', icon: '📚', color: '#3B82F6', order: 50 },
  { id: 'tooling', label: 'Build / CI / repository tooling', icon: '🔧', color: '#64748B', order: 60 },
  { id: 'dependencies', label: 'Dependencies / publishing metadata', icon: '📦', color: '#8B5CF6', order: 70 },
  { id: 'api', label: 'Public API baselines', icon: '📐', color: '#EF4444', order: 80 },
  { id: 'generated', label: 'Generated / reference material', icon: '⚙️', color: '#78716C', order: 90 },
  { id: 'unclassified', label: 'Unclassified source', icon: '⚠️', color: '#F97316', order: 100 },
  { id: 'other', label: 'Other', icon: '◻️', color: '#94A3B8', order: 110 },
]

const SOURCE_EXTENSIONS = [
  '.kt', '.kts', '.java', '.swift', '.scala', '.groovy',
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx',
  '.c', '.cc', '.cpp', '.h', '.hpp', '.m', '.mm',
  '.rs', '.go', '.py', '.rb', '.php', '.cs', '.fs',
  '.sql', '.sq', '.proto',
]

const STATUS_ORDER = ['added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unknown']

const DEFAULT_CONFIG = {
  version: 1,
  title: 'Diff breakdown',
  marker: '<!-- diff-breakdown:v1 -->',
  presets: ['auto'],
  sourceExtensions: SOURCE_EXTENSIONS,
  generated: {
    include: [
      '**/generated/**',
      '**/build/generated/**',
      '**/*.generated.*',
      '**/*.min.js',
    ],
    exclude: [],
  },
  categories: [],
  modules: { roots: [], fallback: true },
  platforms: [],
  dependencyGraph: { edges: [] },
  views: ['composition', 'status', 'modules', 'platforms', 'api', 'dependencies'],
  limits: {
    commentModules: 20,
    commentFiles: 20,
    commentSymbols: 20,
  },
}

module.exports = {
  CATEGORY_DEFINITIONS,
  SOURCE_EXTENSIONS,
  STATUS_ORDER,
  DEFAULT_CONFIG,
}

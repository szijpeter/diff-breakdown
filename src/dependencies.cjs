function analyzeDependencyImpact(modules, edges = []) {
  if (edges.length === 0) {
    return { available: false, nodes: [], edges: [], changed: [], impacted: [] }
  }

  const changed = new Set(modules.filter(module => module.total.files > 0).map(module => module.id))
  const nodes = new Set(changed)
  const reverse = new Map()
  for (const edge of edges) {
    nodes.add(edge.from)
    nodes.add(edge.to)
    if (!reverse.has(edge.to)) reverse.set(edge.to, new Set())
    reverse.get(edge.to).add(edge.from)
  }

  const distance = new Map([...changed].map(module => [module, 0]))
  const queue = [...changed]
  while (queue.length > 0) {
    const dependency = queue.shift()
    const nextDistance = (distance.get(dependency) || 0) + 1
    for (const dependent of reverse.get(dependency) || []) {
      if (!distance.has(dependent) || distance.get(dependent) > nextDistance) {
        distance.set(dependent, nextDistance)
        queue.push(dependent)
      }
    }
  }

  const resultNodes = [...nodes]
    .map(id => ({
      id,
      state: changed.has(id) ? 'changed' : distance.has(id) ? 'impacted' : 'unaffected',
      distance: distance.get(id) ?? null,
    }))
    .sort((left, right) => {
      const leftDistance = left.distance ?? Number.MAX_SAFE_INTEGER
      const rightDistance = right.distance ?? Number.MAX_SAFE_INTEGER
      return leftDistance - rightDistance || left.id.localeCompare(right.id)
    })

  return {
    available: true,
    nodes: resultNodes,
    edges: edges.map(edge => ({ ...edge })),
    changed: resultNodes.filter(node => node.state === 'changed').map(node => node.id),
    impacted: resultNodes.filter(node => node.state === 'impacted').map(node => node.id),
  }
}

module.exports = { analyzeDependencyImpact }

export const collectNodesMutations = (nodes, params, ressource, candidates) => {
  const mutations = []
  nodes.forEach((node) => {
    mutations.push(
      ...collectNodeMutations(node, params, ressource, nodes, candidates),
    )
  })
  return mutations
}

const collectNodeMutations = (node, params, ressource, nodes, candidates) => {
  let firstValueReturned
  candidates.find((candidate) => {
    const returnValue = candidate(node, params, ressource, nodes)
    if (returnValue === null || returnValue === undefined) {
      return false
    }
    firstValueReturned = returnValue
    return true
  })

  if (typeof firstValueReturned === "function") {
    return [firstValueReturned]
  }
  if (Array.isArray(firstValueReturned)) {
    return firstValueReturned
  }
  return []
}

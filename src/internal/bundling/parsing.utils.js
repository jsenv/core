export const collectNodesMutations = (nodes, notifiers, target, candidates) => {
  const mutations = []
  nodes.forEach((node) => {
    mutations.push(...collectNodeMutations(node, notifiers, target, nodes, candidates))
  })
  return mutations
}

const collectNodeMutations = (node, notifiers, target, nodes, candidates) => {
  let firstValueReturned
  candidates.find((candidate) => {
    const returnValue = candidate(node, notifiers, target, nodes)
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

import { getHtmlNodeLocation } from "@jsenv/core/src/internal/compiling/compileHtml.js"

export const collectNodesMutations = (
  nodes,
  notifiers,
  ressource,
  candidates,
) => {
  const mutations = []
  nodes.forEach((node) => {
    mutations.push(
      ...collectNodeMutations(node, notifiers, ressource, nodes, candidates),
    )
  })
  return mutations
}

export const htmlNodeToReferenceLocation = (htmlNode) => {
  const { line, column } = getHtmlNodeLocation(htmlNode)
  return {
    referenceLine: line,
    referenceColumn: column,
  }
}

const collectNodeMutations = (
  node,
  notifiers,
  ressource,
  nodes,
  candidates,
) => {
  let firstValueReturned
  candidates.find((candidate) => {
    const returnValue = candidate(node, notifiers, ressource, nodes)
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

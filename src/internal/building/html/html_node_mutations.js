import { visitHtmlAst } from "@jsenv/core/src/internal/transform_html/html_ast.js"

export const collectHtmlMutations = (htmlAst, candidates, params) => {
  const htmlMutations = []
  visitHtmlAst(htmlAst, (node) => {
    const nodeMutations = collectNodeMutations(node, candidates, params)
    htmlMutations.push(...nodeMutations)
  })
  return htmlMutations
}

const collectNodeMutations = (node, candidates, params) => {
  let firstValueReturned
  candidates.find((candidate) => {
    const returnValue = candidate(node, params)
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

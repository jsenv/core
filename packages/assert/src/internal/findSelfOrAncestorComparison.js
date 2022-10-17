export const findSelfOrAncestorComparison = (comparison, predicate) => {
  let current = comparison
  let foundComparison
  while (current) {
    if (current && predicate(current)) {
      foundComparison = current
      current = foundComparison.parent
      while (current) {
        if (predicate(current)) foundComparison = current
        current = current.parent
      }
      return foundComparison
    }
    current = current.parent
  }
  return null
}

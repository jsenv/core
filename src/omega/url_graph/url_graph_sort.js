export const sortUrlGraphByDependencies = (urlGraph) => {
  const { urlInfos } = urlGraph

  const visited = []
  const sorted = []
  const circular = []
  const visit = (url) => {
    const isSorted = sorted.includes(url)
    if (isSorted) {
      return
    }
    const isVisited = visited.includes(url)
    if (isVisited) {
      circular.push(url)
      sorted.push(url)
    } else {
      visited.push(url)
      urlInfos[url].dependencies.forEach((dependencyUrl) => {
        visit(dependencyUrl, url)
      })
      sorted.push(url)
    }
  }
  Object.keys(urlInfos).forEach((url) => {
    visit(url)
  })
  sorted.circular = circular
  return sorted
}

export const GRAPH = {
  map: (graph, callback) => {
    const array = []
    graph.urlInfoMap.forEach((urlInfo) => {
      array.push(callback(urlInfo))
    })
    return array
  },

  forEach: (graph, callback) => {
    graph.urlInfoMap.forEach(callback)
  },

  filter: (graph, callback) => {
    const urlInfos = []
    graph.urlInfoMap.forEach((urlInfo) => {
      if (callback(urlInfo)) {
        urlInfos.push(urlInfo)
      }
    })
    return urlInfos
  },

  find: (graph, callback) => {
    let found = null
    for (const urlInfo of graph.urlInfoMap.values()) {
      if (callback(urlInfo)) {
        found = urlInfo
        break
      }
    }
    return found
  },
}

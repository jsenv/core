export const GRAPH = {
  map: (graph, callback) => {
    return Object.keys(graph.urlInfos).map((url) => {
      return callback(graph.urlInfos[url])
    })
  },

  forEach: (graph, callback) => {
    Object.keys(graph.urlInfos).forEach((url) => {
      callback(graph.urlInfos[url], url)
    })
  },

  filter: (graph, callback) => {
    const urlInfos = []
    Object.keys(graph.urlInfos).forEach((url) => {
      const urlInfo = graph.urlInfos[url]
      if (callback(urlInfo)) {
        urlInfos.push(urlInfo)
      }
    })
    return urlInfos
  },

  find: (graph, callback) => {
    const urlFound = Object.keys(graph.urlInfos).find((url) => {
      return callback(graph.urlInfos[url])
    })
    return graph.urlInfos[urlFound]
  },
}

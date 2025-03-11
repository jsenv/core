const createDependencyGraph = () => {
  const nodes = {}
  const getOrCreateNode = (url) => {
    const existing = nodes[url]
    if (existing) {
      return existing
    }
    const node = createNode(url)
    nodes[url] = node
    return node
  }
  const createNode = (url) => {
    const node = {}
    const promiseWithResolve = (newStatus) => {
      let resolved = false
      let resolve
      const promise = new Promise((r) => {
        resolve = r
      }).then(() => {
        node.status = newStatus
      })
      promise.resolve = (value) => {
        if (resolved) return
        resolve(value)
      }
      return promise
    }
    const knownPromise = promiseWithResolve(
      "waiting_for_dependencies_to_be_ready",
    )
    const readyPromise = promiseWithResolve("ready")
    const setDependencies = async (dependencies) => {
      node.dependencies = dependencies
      knownPromise.resolve()
      const promises = dependencies.map((dependencyNode) => {
        // for circular dependency we wait for knownPromise
        if (hasDependencyOn(dependencyNode, node)) {
          return dependencyNode.knownPromise
        }
        return dependencyNode.readyPromise
      })
      readyPromise.resolve(Promise.all(promises))
    }
    Object.assign(node, {
      url,
      status: "waiting_to_know_dependencies",
      dependencies: [],
      setDependencies,
      knownPromise,
      readyPromise,
    })
    return node
  }
  const setDependencyUrls = async (url, dependencyUrls) => {
    console.log("url dependencies are known for:", url)
    const node = getOrCreateNode(url)
    const dependencies = dependencyUrls.map((dependencyUrl) =>
      getOrCreateNode(dependencyUrl),
    )
    node.setDependencies(dependencies)
    await node.readyPromise
    console.log("url is ready:", url)
  }
  return { setDependencyUrls }
}

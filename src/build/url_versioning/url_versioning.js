import { createUrlVersionGenerator } from "@jsenv/core/src/utils/url_version_generator.js"

// import { jsenvPluginAvoidVersioningCascade } from "./plugins/avoid_versioning_cascade/jsenv_plugin_avoid_versioning_cascade.js"

export const applyUrlVersioningOnUrlInfos = async (
  urlInfos,
  { buildUrlsGenerator, lineBreakNormalization = process.platform === "win32" },
) => {
  const dependencyGraph = createDependencyGraph()
  // TODO: we don't need the promise anymore
  // we can just sort and apply url versioning by least dependent
  // for circular dep we'll have a special case and ignore the circular import
  for (const urlInfo of urlInfos) {
    const dependencyUrls = Array.from(urlInfo.dependencies.values())
    const readyPromise = dependencyGraph.setDependencyUrls(
      urlInfo.url,
      dependencyUrls,
    )
    await readyPromise

    const urlVersionGenerator = createUrlVersionGenerator()
    urlVersionGenerator.augmentWithContent({
      content: urlInfo.content,
      contentType: urlInfo.contentType,
      lineBreakNormalization,
    })
    dependencyUrls.forEach((dependencyUrl) => {
      const dependencyUrlInfo = urlInfos[dependencyUrl]
      if (dependencyUrlInfo.version) {
        urlVersionGenerator.augmentWithDependencyVersion(
          dependencyUrlInfo.version,
        )
      } else {
        // because all dependencies are know, if the dependency has no version
        // it means there is a circular dependency between this file
        // and it's dependency
        // in that case we'll use the dependency content
        urlVersionGenerator.augmentWithContent({
          content: dependencyUrlInfo.content,
          contentType: dependencyUrlInfo.contentType,
          lineBreakNormalization,
        })
      }
    })
    urlInfo.version = urlVersionGenerator.generate()
    const { buildRelativeUrl, buildUrl } = buildUrlsGenerator.generate(
      urlInfo.url,
      urlInfo.type === "js_module" ? "/" : "assets/",
    )
    urlInfo.buildRelativeUrl = buildRelativeUrl
    urlInfo.buildUrl = buildUrl

    // TODO: update urls in urlInfo.content
    // using replaceUrls
  }
}

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

const hasDependencyOn = (node, otherNode) => {
  for (const dependencyNode of node.dependencies) {
    if (dependencyNode.url === otherNode.url) {
      return true
    }
    if (hasDependencyOn(dependencyNode, otherNode)) {
      return true
    }
  }
  return false
}

import { createLog, startSpinner, UNICODE, ANSI } from "@jsenv/log"

import { createProjectGraph } from "@jsenv/core/src/omega/project_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"
import { createUrlVersionGenerator } from "@jsenv/core/src/utils/url_versioning.js"
import { byteAsFileSize } from "@jsenv/core/src/utils/logs/size_log.js"
import { msAsDuration } from "@jsenv/core/src/utils/logs/duration_log.js"

import { jsenvPluginAvoidVersioningCascade } from "./plugins/avoid_versioning_cascade/jsenv_plugin_avoid_versioning_cascade.js"

export const loadGraph = async ({
  signal,
  logger,
  projectDirectoryUrl,
  // buildUrlsGenerator,

  entryPoints,
  plugins,
  runtimeSupport,
  sourcemapInjection,
  lineBreakNormalization = process.platform === "win32",
}) => {
  const startMs = Date.now()
  const buildingLog = createLog()
  const spinner = startSpinner({
    log: buildingLog,
    text: `Loading project graph`,
  })
  let kitchen
  const urlPromiseCache = {}
  let urlCount = 0

  const dependencyGraph = createDependencyGraph()

  const cookUrl = ({ url, ...rest }) => {
    const promiseFromCache = urlPromiseCache[url]
    if (promiseFromCache) return promiseFromCache

    const promise = _cookUrl({
      outDirectoryName: `build`,
      runtimeSupport,
      url,
      onDependencies: async ({ url }) => {
        const urlInfo = projectGraph.getUrlInfo(url)
        const { dependencies, dependencyUrlSites } = urlInfo
        const dependencyUrls = Array.from(dependencies.values())
        const readyPromise = dependencyGraph.setDependencyUrls(
          url,
          dependencyUrls,
        )
        dependencies.forEach((dependencyUrl) => {
          cookUrl({
            parentUrl: url,
            urlTrace: {
              type: "url_site",
              value: dependencyUrlSites[dependencyUrl],
            },
            url: dependencyUrl,
          })
        })
        await readyPromise
        const urlVersionGenerator = createUrlVersionGenerator()
        urlVersionGenerator.augmentWithContent({
          content: urlInfo.content,
          contentType: urlInfo.contentType,
          lineBreakNormalization,
        })
        dependencies.forEach((dependencyUrl) => {
          const dependencyUrlInfo = projectGraph.getUrlInfo(dependencyUrl)
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
      },
      ...rest,
    })
    urlPromiseCache[url] = promise
    return promise
  }

  const _cookUrl = async (params) => {
    urlCount++
    spinner.text = `Loading project graph ${urlCount}`
    const cookedUrl = await kitchen.cookUrl(params)
    if (cookedUrl.error) {
      spinner.stop(`${UNICODE.FAILURE} Failed to load project graph`)
      throw cookedUrl.error
    }
    return cookedUrl
  }

  const projectGraph = createProjectGraph({
    projectDirectoryUrl,
    scenario: "build",
  })
  kitchen = createKitchen({
    signal,
    logger,
    projectDirectoryUrl,
    plugins: [
      jsenvPluginUrlVersioning(),
      jsenvPluginAvoidVersioningCascade(),
      ...plugins,
    ],
    runtimeSupport,
    sourcemapInjection,
    projectGraph,
    scenario: "build",
  })

  await Object.keys(entryPoints).reduce(
    async (previous, entryPointRelativeUrl) => {
      await previous
      const entryPointUrl = kitchen.resolveSpecifier({
        parentUrl: projectDirectoryUrl,
        specifierType: "http_request", // not really but kinda
        specifier: entryPointRelativeUrl,
      })
      await cookUrl({
        parentUrl: projectDirectoryUrl,
        urlTrace: {
          type: "parameter",
          value: `"entryPoints" parameter to buildProject`,
        },
        url: entryPointUrl,
      })
    },
    Promise.resolve(),
  )

  await Promise.all(
    Object.keys(urlPromiseCache).map((key) => urlPromiseCache[key]),
  )

  // here we can perform many checks such as ensuring ressource hints are used

  const graphStats = createProjectGraphStats(projectGraph)
  const msEllapsed = Date.now() - startMs
  spinner.stop(
    `${UNICODE.OK} project graph loaded in ${msAsDuration(msEllapsed)}`,
  )
  logger.info(`--- graph summary ---  
${createRepartitionMessage(graphStats)}
${ANSI.color(`Total:`, ANSI.GREY)} ${graphStats.total.count} (${byteAsFileSize(
    graphStats.total.size,
  )})
---------------------`)
  return projectGraph
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

const jsenvPluginUrlVersioning = () => {
  return {
    name: "jsenv:url_versioning",
    appliesDuring: { build: true },
  }

  // cooked: ({ projectGraph, url, type }) => {
  //   // at this stage all deps are known and url mentions are replaced
  //   // "content" accurately represent the file content
  //   // and can be used to version the url
  //   const urlInfo = projectGraph.urlInfos[url]
  //   const { buildRelativeUrl, buildUrl } = buildUrlsGenerator.generate(
  //     urlToFilename(url),
  //     type === "js_module" ? "/" : "assets/",
  //   )
  //   urlInfo.buildRelativeUrl = buildRelativeUrl
  //   urlInfo.buildUrl = buildUrl
  // },
}

// TODO: exlude inline files
// more groups:
// - js_classic
// - graphics: jpg, png, fonts, svgs
// - audio: mp3, ogg, midi
// - video: mp4
const createProjectGraphStats = (projectGraph) => {
  const { urlInfos } = projectGraph
  const countGroups = {
    html: 0,
    css: 0,
    js_module: 0,
    other: 0,
    total: 0,
  }
  const sizeGroups = {
    html: 0,
    css: 0,
    js_module: 0,
    other: 0,
    total: 0,
  }
  Object.keys(urlInfos).forEach((url) => {
    const urlInfo = urlInfos[url]
    const urlContentSize = Buffer.byteLength(urlInfo.content)
    countGroups.total++
    sizeGroups.total += urlContentSize

    const category = determineCategory(urlInfo)

    if (category === "html") {
      countGroups.html++
      sizeGroups.html += urlContentSize
      return
    }
    if (category === "css") {
      countGroups.css++
      sizeGroups.css += urlContentSize
      return
    }
    if (category === "js_module") {
      countGroups.js_module++
      sizeGroups.js_module += urlContentSize
      return
    }
    countGroups.other++
    sizeGroups.other += urlContentSize
    return
  })
  return {
    html: { count: countGroups.html, size: sizeGroups.html },
    css: { count: countGroups.css, size: sizeGroups.css },
    js_module: { count: countGroups.js_module, size: sizeGroups.js_module },
    other: { count: countGroups.other, size: sizeGroups.other },
    total: { count: countGroups.total, size: sizeGroups.total },
  }
}

const determineCategory = (urlInfo) => {
  if (urlInfo.type === "html") {
    return "html"
  }
  if (urlInfo.type === "css") {
    return "css"
  }
  if (urlInfo.type === "js_module") {
    const urlObject = new URL(urlInfo.url)
    if (urlObject.searchParams.has("json_module")) {
      return "json"
    }
    if (urlObject.searchParams.has("css_module")) {
      return "css"
    }
    if (urlObject.searchParams.has("text_module")) {
      return "text"
    }
    return "js_module"
  }
  return urlInfo.type
}

const createRepartitionMessage = ({ html, css, js_module, other }) => {
  const parts = []
  if (html.count) {
    parts.push(
      `${ANSI.color(`html:`, ANSI.GREY)} ${html.count} (${byteAsFileSize(
        html.size,
      )})`,
    )
  }
  if (css.count) {
    parts.push(
      `${ANSI.color(`css:`, ANSI.GREY)} ${css.count} (${byteAsFileSize(
        css.size,
      )})`,
    )
  }
  if (js_module.count) {
    parts.push(
      `${ANSI.color(`js module:`, ANSI.GREY)} ${
        js_module.count
      } (${byteAsFileSize(js_module.size)})`,
    )
  }
  if (other.count) {
    parts.push(
      `${ANSI.color(`other:`, ANSI.GREY)} ${other.count} (${byteAsFileSize(
        other.size,
      )})`,
    )
  }
  return `- ${parts.join(`
- `)}`
}

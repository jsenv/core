import { createLog, startSpinner, UNICODE, ANSI } from "@jsenv/log"

import { createProjectGraph } from "@jsenv/core/src/omega/project_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"
import { byteAsFileSize } from "@jsenv/core/src/utils/logs/size_log.js"
import { msAsDuration } from "@jsenv/core/src/utils/logs/duration_log.js"
import { jsenvPluginAvoidVersioningCascade } from "./plugins/avoid_versioning_cascade/jsenv_plugin_avoid_versioning_cascade.js"

export const buildGraph = async ({
  signal,
  logger,
  projectDirectoryUrl,
  entryPoints,
  plugins,
  runtimeSupport,
  sourcemapInjection,
}) => {
  const projectGraph = createProjectGraph({
    projectDirectoryUrl,
  })
  const kitchen = createKitchenForBuild({
    signal,
    logger,
    projectDirectoryUrl,
    plugins: [jsenvPluginAvoidVersioningCascade(), ...plugins],
    runtimeSupport,
    sourcemapInjection,
    projectGraph,
  })

  const buildingLog = createLog()
  const spinner = startSpinner({
    log: buildingLog,
    text: `Loading project graph`,
  })
  let urlPromiseCache = {}
  let urlCount = 0
  const cookUrl = ({ url, ...rest }) => {
    const promiseFromCache = urlPromiseCache[url]
    if (promiseFromCache) return promiseFromCache
    const promise = _cookUrl({
      outDirectoryName: `build`,
      runtimeSupport,
      url,
      ...rest,
    })
    urlPromiseCache[url] = promise
    return promise
  }
  const _cookUrl = async (params) => {
    const cookedUrl = await kitchen.cookUrl(params)
    if (cookedUrl.error) {
      spinner.stop(`${UNICODE.FAILURE} Failed to load project graph`)
      throw cookedUrl.error
    }
    urlCount++
    spinner.text = `Loading project graph ${urlCount}`
    // cook dependencies
    await Promise.all(
      cookedUrl.urlMentions.map(async (urlMention) => {
        await cookUrl({
          parentUrl: cookedUrl.url,
          urlTrace: {
            type: "url_site",
            value: {
              url: cookedUrl.url,
              line: urlMention.line,
              column: urlMention.column,
            },
          },
          url: urlMention.url,
        })
      }),
    )
    return cookedUrl
  }

  await entryPoints.reduce(async (previous, entryPointRelativeUrl) => {
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
  }, Promise.resolve())

  const {
    fileCount,
    totalSize,
    htmlCount,
    cssCount,
    jsModuleCount,
    otherCount,
  } = createProjectGraphStats(projectGraph)
  spinner.stop(`${UNICODE.OK} project graph loaded in ${msAsDuration()}`)
  buildingLog.write(`
  - project files: ${fileCount} (${byteAsFileSize(totalSize)})
  - repartition: ${createRepartitionMessage({
    htmlCount,
    cssCount,
    jsModuleCount,
    otherCount,
  })}
`)
  return projectGraph
}

const createKitchenForBuild = ({
  signal,
  logger,
  projectDirectoryUrl,
  plugins,
  runtimeSupport,
  sourcemapInjection,
  projectGraph,
}) => {
  const kitchen = createKitchen({
    signal,
    logger,
    projectDirectoryUrl,
    plugins,
    runtimeSupport,
    sourcemapInjection,
    projectGraph,
    scenario: "build",
  })
  return kitchen
}

const createProjectGraphStats = (projectGraph) => {
  const { urlInfos } = projectGraph
  let fileCount = 0
  let totalSize = 0
  const htmlUrls = []
  const cssUrls = []
  const jsModuleUrls = []
  const otherUrls = []
  Object.keys(urlInfos).forEach((url) => {
    const urlInfo = urlInfos[url]
    // TODO: exlude inline files
    fileCount++
    totalSize += Buffer.byteLength(urlInfo.content)

    if (urlInfo.type === "html") {
      htmlUrls.push(urlInfo)
      return
    }
    if (urlInfo.type === "css") {
      cssUrls.push(urlInfo)
      return
    }
    if (urlInfo.type === "js_module") {
      const urlObject = new URL(url)
      if (urlObject.searchParams.has("json_module")) {
        otherUrls.push(urlInfo)
        return
      }
      if (urlObject.searchParams.has("css_module")) {
        cssUrls.push(urlInfo)
        return
      }
      if (urlObject.searchParams.has("text_module")) {
        otherUrls.push(urlInfo)
        return
      }
      jsModuleUrls.push(urlInfo)
      return
    }
    otherUrls.push(urlInfo)
    return
  })
  return {
    fileCount,
    totalSize,
    htmlCount: htmlUrls.length,
    cssCount: cssUrls.length,
    jsModuleCount: jsModuleUrls.length,
    otherCount: otherUrls.length,
  }
}

const createRepartitionMessage = ({
  htmlCount,
  cssCount,
  jsModuleCount,
  otherCount,
}) => {
  const parts = []
  if (htmlCount) {
    parts.push(`${htmlCount} ${ANSI.color(`html`, ANSI.BLUE)}`)
  }
  if (cssCount) {
    parts.push(`${cssCount} ${ANSI.color(`css`, ANSI.MAGENTA)}`)
  }
  if (jsModuleCount) {
    parts.push(`${jsModuleCount} ${ANSI.color(`js module`, ANSI.GREEN)}`)
  }
  if (otherCount) {
    parts.push(`${otherCount} ${ANSI.color(`other`, ANSI.GREY)}`)
  }
  return `${parts.join(", ")}`
}

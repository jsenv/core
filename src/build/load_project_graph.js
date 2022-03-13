import { createLog, startSpinner, UNICODE, ANSI } from "@jsenv/log"

import { createUrlGraph } from "@jsenv/core/src/omega/url_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"
import { byteAsFileSize } from "@jsenv/core/src/utils/logs/size_log.js"
import { msAsDuration } from "@jsenv/core/src/utils/logs/duration_log.js"

export const loadProjectGraph = async ({
  signal,
  logger,
  projectDirectoryUrl,

  entryPoints,
  plugins,
  runtimeSupport,
  sourcemapInjection,
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
    urlCount++
    spinner.text = `Loading project graph ${urlCount}`
    const cookedUrl = await kitchen.cookUrl(params)
    if (cookedUrl.error) {
      spinner.stop(`${UNICODE.FAILURE} Failed to load project graph`)
      throw cookedUrl.error
    }
    const urlInfo = urlGraph.getUrlInfo(cookedUrl.url)
    const { url, dependencies, dependencyUrlSites } = urlInfo
    const dependencyUrls = Array.from(dependencies.values())
    await Promise.all(
      dependencyUrls.map(async (dependencyUrl) => {
        await cookUrl({
          parentUrl: url,
          urlTrace: {
            type: "url_site",
            value: dependencyUrlSites[dependencyUrl],
          },
          url: dependencyUrl,
        })
      }),
    )
    return cookedUrl
  }

  const urlGraph = createUrlGraph({
    projectDirectoryUrl,
    scenario: "build",
  })
  kitchen = createKitchen({
    signal,
    logger,
    projectDirectoryUrl,
    plugins,
    runtimeSupport,
    sourcemapInjection,
    urlGraph,
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

  const graphStats = createProjectGraphStats(urlGraph)
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
  return urlGraph
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

import { createLog, startSpinner, UNICODE, ANSI } from "@jsenv/log"
import { urlToFilename } from "@jsenv/filesystem"

import { createProjectGraph } from "@jsenv/core/src/omega/project_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"
import { injectQueryParams } from "@jsenv/core/src/utils/url_utils.js"

import { byteAsFileSize } from "@jsenv/core/src/utils/logs/size_log.js"
import { msAsDuration } from "@jsenv/core/src/utils/logs/duration_log.js"

import { createAvailableNameGenerator } from "./build_url_generator.js"
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
    return cookedUrl
  }

  const projectGraph = createProjectGraph({
    projectDirectoryUrl,
    scenario: "build",
  })
  const availableNameGenerator = createAvailableNameGenerator()
  kitchen = createKitchen({
    signal,
    logger,
    projectDirectoryUrl,
    plugins: [
      {
        name: "jsenv:build_dependencies",
        appliesDuring: { build: true },
        dependencyResolved: async ({ url, urlMentions }) => {
          await Promise.all(
            urlMentions.map(async (urlMention) => {
              await cookUrl({
                parentUrl: url,
                urlTrace: {
                  type: "url_site",
                  value: {
                    url,
                    line: urlMention.line,
                    column: urlMention.column,
                  },
                },
                url: urlMention.url,
              })
            }),
          )
          // at this stage we can compute url version
          // but why do we need to cook dependency for that?
          // oh yes because dependency will influence the url mention in that file
          // so dependency version must be computed first
          // and to compute version we need first to wait for url mention to be replaced
          // in a file (so waiting for cooked is good)
        },
      },
      jsenvPluginAvoidVersioningCascade(),
      ...plugins,
    ],
    runtimeSupport,
    sourcemapInjection,
    projectGraph,
    scenario: "build",
    urlMentionHandlers: {
      "js_import_meta_url_pattern": (urlMention) => {
        const assetName = availableNameGenerator.generateAssetName(
          urlToFilename(urlMention.url),
        )
        urlsReferencedByJs.push(urlMention.url)
        return `window.__asVersionedSpecifier__("./${assetName}")`
      },
      // pour import statique on pourrait esperer que importmap fonctionne
      // mais le support est insuffisant donc on va garder l'import sans la version
      // pareil pour les imports dynamique, c'est rollup qui se chargera de ça
      "js_import_export": (urlMention, { asClientUrl }) => {
        return JSON.stringify(asClientUrl(urlMention.url))
      },
      "*": (urlMention, { asClientUrl }) => {
        const clientUrl = asClientUrl(urlMention.url)
        const clientUrlVersioned = injectQueryParams(clientUrl, {
          v: projectGraph.urlInfos[urlMention.url].version,
        })
        return clientUrlVersioned
      },
    },
  })

  const urlsReferencedByJs = []

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

  const graphStats = createProjectGraphStats(projectGraph)
  spinner.stop(`${UNICODE.OK} project graph loaded in ${msAsDuration()}`)
  logger.info(`--- graph summary ---  
${createRepartitionMessage(graphStats)}
${ANSI.color(`Total:`, ANSI.GREY)} ${graphStats.total.count} (${byteAsFileSize(
    graphStats.total.size,
  )})
---------------------`)
  return projectGraph
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

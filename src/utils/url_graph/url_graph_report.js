import { ANSI } from "@jsenv/log"

import { byteAsFileSize } from "@jsenv/core/src/utils/logs/size_log.js"

export const createUrlGraphSummary = (
  urlGraph,
  { title = "graph summary" } = {},
) => {
  const graphReport = createUrlGraphReport(urlGraph)
  const totalLabel = graphReport.sourcemaps.count
    ? `Total (ignoring sourcemaps):`
    : `Total`

  return `--- ${title} ---  
${createRepartitionMessage(graphReport)}
${ANSI.color(totalLabel, ANSI.GREY)} ${
    graphReport.total.count
  } (${byteAsFileSize(graphReport.total.size)})
--------------------`
}

const createUrlGraphReport = (urlGraph) => {
  const { urlInfos } = urlGraph
  const countGroups = {
    html: 0,
    css: 0,
    js: 0,
    assets: 0,
    sourcemaps: 0,
    total: 0,
  }
  const sizeGroups = {
    html: 0,
    css: 0,
    js: 0,
    sourcemaps: 0,
    assets: 0,
    total: 0,
  }
  Object.keys(urlInfos).forEach((url) => {
    const urlInfo = urlInfos[url]
    // ignore inline files, they are already taken into account in the file where they appear
    if (urlInfo.inlineUrlSite) {
      return
    }
    // file loaded via import assertion are already inside the graph
    // their js module equivalent are ignored to avoid counting it twice
    // in the build graph the file targeted by import assertion will likely be gone
    // and only the js module remain (likely bundled)
    const urlObject = new URL(urlInfo.url)
    if (
      urlObject.searchParams.has("json_module") ||
      urlObject.searchParams.has("css_module") ||
      urlObject.searchParams.has("text_module")
    ) {
      return
    }
    const urlContentSize = Buffer.byteLength(urlInfo.content)
    const category = determineCategory(urlInfo)
    if (category === "sourcemap") {
      countGroups.sourcemaps++
      sizeGroups.sourcemaps += urlContentSize
      return
    }
    countGroups.total++
    sizeGroups.total += urlContentSize
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
    if (category === "js") {
      countGroups.js++
      sizeGroups.js += urlContentSize
      return
    }
    countGroups.assets++
    sizeGroups.assets += urlContentSize
    return
  })
  return {
    html: { count: countGroups.html, size: sizeGroups.html },
    css: { count: countGroups.css, size: sizeGroups.css },
    js: { count: countGroups.js, size: sizeGroups.js },
    sourcemaps: { count: countGroups.sourcemaps, size: sizeGroups.sourcemaps },
    assets: { count: countGroups.assets, size: sizeGroups.assets },
    total: { count: countGroups.total, size: sizeGroups.total },
  }
}

const determineCategory = (urlInfo) => {
  if (urlInfo.type === "sourcemap") {
    return "sourcemap"
  }
  if (urlInfo.type === "html") {
    return "html"
  }
  if (urlInfo.type === "css") {
    return "css"
  }
  if (
    urlInfo.type === "js_module" ||
    urlInfo.type === "js_classic" ||
    urlInfo.type === "worker_module" ||
    urlInfo.type === "worker_classic" ||
    urlInfo.type === "service_worker_module" ||
    urlInfo.type === "service_worker_classic"
  ) {
    return "js"
  }
  return "assets"
}

const createRepartitionMessage = ({ html, css, js, sourcemaps, assets }) => {
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
  if (js.count) {
    parts.push(
      `${ANSI.color(`js:`, ANSI.GREY)} ${js.count} (${byteAsFileSize(
        js.size,
      )})`,
    )
  }
  if (sourcemaps.count) {
    parts.push(
      `${ANSI.color(`sourcemaps:`, ANSI.GREY)} ${
        sourcemaps.count
      } (${byteAsFileSize(sourcemaps.size)})`,
    )
  }
  if (assets.count) {
    parts.push(
      `${ANSI.color(`assets:`, ANSI.GREY)} ${assets.count} (${byteAsFileSize(
        assets.size,
      )})`,
    )
  }
  return `- ${parts.join(`
- `)}`
}

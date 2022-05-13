import { ANSI } from "@jsenv/log"

import { byteAsFileSize } from "@jsenv/utils/logs/size_log.js"

export const createUrlGraphSummary = (
  urlGraph,
  { title = "graph summary" } = {},
) => {
  const graphReport = createUrlGraphReport(urlGraph)
  const totalLabel = `Total`
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
    other: 0,
    sourcemaps: 0,
    total: 0,
  }
  const sizeGroups = {
    html: 0,
    css: 0,
    js: 0,
    sourcemaps: 0,
    other: 0,
    total: 0,
  }
  Object.keys(urlInfos).forEach((url) => {
    if (url.startsWith("data:")) {
      return
    }
    const urlInfo = urlInfos[url]
    // ignore:
    // - inline files: they are already taken into account in the file where they appear
    // - external files: we don't know their content
    if (urlInfo.isInline || urlInfo.external) {
      return
    }
    // file loaded via import assertion are already inside the graph
    // their js module equivalent are ignored to avoid counting it twice
    // in the build graph the file targeted by import assertion will likely be gone
    // and only the js module remain (likely bundled)
    const urlObject = new URL(urlInfo.url)
    if (
      urlObject.searchParams.has("as_json_module") ||
      urlObject.searchParams.has("as_css_module") ||
      urlObject.searchParams.has("as_text_module")
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
    countGroups.other++
    sizeGroups.other += urlContentSize
    return
  })
  return {
    html: { count: countGroups.html, size: sizeGroups.html },
    css: { count: countGroups.css, size: sizeGroups.css },
    js: { count: countGroups.js, size: sizeGroups.js },
    sourcemaps: { count: countGroups.sourcemaps, size: sizeGroups.sourcemaps },
    other: { count: countGroups.other, size: sizeGroups.other },
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
  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    return "js"
  }
  return "other"
}

const createRepartitionMessage = ({ html, css, js, other }) => {
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
  // if (sourcemaps.count) {
  //   parts.push(
  //     `${ANSI.color(`sourcemaps:`, ANSI.GREY)} ${
  //       sourcemaps.count
  //     } (${byteAsFileSize(sourcemaps.size)})`,
  //   )
  // }
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

import { urlToFilename } from "@jsenv/filesystem"

import { memoizeByUrl } from "@jsenv/utils/memoize/memoize_by_url.js"

export const createBuilUrlsGenerator = ({ buildDirectoryUrl }) => {
  const cache = {}
  const generate = memoizeByUrl((url, urlInfo, parentUrlInfo) => {
    const directoryPath = determineDirectoryPath(urlInfo, parentUrlInfo)
    let name = urlToFilename(url)
    const { searchParams } = new URL(url)
    if (
      searchParams.has("css_module") ||
      searchParams.has("json_module") ||
      searchParams.has("text_module")
    ) {
      name = `${name}.js`
    }
    let names = cache[directoryPath]
    if (!names) {
      names = []
      cache[directoryPath] = names
    }

    let nameCandidate = name
    let integer = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!names.includes(nameCandidate)) {
        names.push(nameCandidate)
        break
      }
      integer++
      nameCandidate = `${name}${integer}`
    }
    return `${buildDirectoryUrl}${directoryPath}${nameCandidate}`
  })

  return {
    generate,
  }
}

const determineDirectoryPath = (urlInfo, parentUrlInfo) => {
  if (urlInfo.isInline) {
    const parentDirectoryPath = determineDirectoryPath(parentUrlInfo)
    return parentDirectoryPath
  }
  if (urlInfo.data.isEntryPoint) {
    return ""
  }
  if (urlInfo.type === "html") {
    return "html/"
  }
  if (urlInfo.type === "css") {
    return "css/"
  }
  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    if (urlInfo.subtype === "service_worker") {
      return ""
    }
    return "js/"
  }
  return "assets/"
}

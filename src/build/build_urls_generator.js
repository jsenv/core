import { urlToFilename } from "@jsenv/filesystem"

import { memoizeByUrl } from "@jsenv/core/src/utils/memoize/memoize_by_url.js"

export const createBuilUrlsGenerator = ({ buildDirectoryUrl }) => {
  const cache = {}
  const generate = memoizeByUrl((url, urlInfo) => {
    const directoryPath = determineDirectoryPath(urlInfo)
    const name = urlToFilename(url)
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

const determineDirectoryPath = (urlInfo) => {
  if (urlInfo.inlineUrlSite) {
    // should inherit the parent location?
    // should just not reach this
    return ""
  }
  if (urlInfo.data.isEntryPoint) {
    return ""
  }
  if (
    urlInfo.type === "service_worker_module" ||
    urlInfo.type === "service_worker_classic"
  ) {
    return ""
  }
  if (urlInfo.type === "sourcemap") {
    return "sourcemaps/"
  }
  if (urlInfo.type === "html") {
    return "html/"
  }
  if (urlInfo.type === "css") {
    return "css/"
  }
  if (
    urlInfo.type === "js_module" ||
    urlInfo.type === "js_classic" ||
    urlInfo.type === "worker_module" ||
    urlInfo.type === "worker_classic"
  ) {
    return "js/"
  }
  return "assets/"
}

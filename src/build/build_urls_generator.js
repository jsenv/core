import { urlToFilename } from "@jsenv/filesystem"

import { memoizeByUrl } from "@jsenv/utils/memoize/memoize_by_url.js"

export const createBuilUrlsGenerator = ({ buildDirectoryUrl }) => {
  const cache = {}

  const getUrlName = (url, urlInfo) => {
    if (!urlInfo) {
      return urlToFilename(url)
    }
    if (urlInfo.filename) {
      return urlInfo.filename
    }
    return urlToFilename(url)
  }

  const generate = memoizeByUrl((url, { urlInfo, parentUrlInfo }) => {
    const directoryPath = determineDirectoryPath({
      urlInfo,
      parentUrlInfo,
    })
    let names = cache[directoryPath]
    if (!names) {
      names = []
      cache[directoryPath] = names
    }
    const urlObject = new URL(url)
    let { search, hash } = urlObject
    let name = getUrlName(url, urlInfo)
    let [basename, extension] = splitFileExtension(name)
    extension = extensionMappings[extension] || extension
    let nameCandidate = `${basename}${extension}` // reconstruct name in case extension was normalized
    let integer = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!names.includes(nameCandidate)) {
        names.push(nameCandidate)
        break
      }
      integer++
      nameCandidate = `${basename}${integer}${extension}`
    }
    return `${buildDirectoryUrl}${directoryPath}${nameCandidate}${search}${hash}`
  })

  return {
    generate,
  }
}

// It's best to generate files with an extension representing what is inside the file
// and after build js files contains solely js (js or typescript is gone).
// This way a static file server is already configured to server the correct content-type
// (otherwise one would have to configure that ".jsx" is "text/javascript")
// To keep in mind: if you have "user.jsx" and "user.js" AND both file are not bundled
// you end up with "dist/js/user.js" and "dist/js/user2.js"
const extensionMappings = {
  ".ts": ".js",
  ".jsx": ".js",
  ".tsx": ".js",
}

const splitFileExtension = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".")
  if (dotLastIndex === -1) {
    return [filename, ""]
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)]
}

const determineDirectoryPath = ({ urlInfo, parentUrlInfo }) => {
  if (urlInfo.isInline) {
    const parentDirectoryPath = determineDirectoryPath({
      urlInfo: parentUrlInfo,
    })
    return parentDirectoryPath
  }
  if (urlInfo.data.isEntryPoint || urlInfo.data.isWebWorkerEntryPoint) {
    return ""
  }
  if (urlInfo.type === "importmap") {
    return ""
  }
  if (urlInfo.type === "html") {
    return "html/"
  }
  if (urlInfo.type === "css") {
    return "css/"
  }
  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    return "js/"
  }
  if (urlInfo.type === "json") {
    return "json/"
  }
  return "other/"
}

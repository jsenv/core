import { urlToFilename } from "@jsenv/filesystem"

import { memoizeByUrl } from "@jsenv/core/src/utils/memoize/memoize_by_url.js"

export const createBuilUrlsGenerator = ({ baseUrl }) => {
  // TODO: normalize baseUrl
  // if a valid url:
  //   - ensure trailing slash
  // otherwise assert it's a string +
  //   - ensure leading slash
  //   - ensure trailing slash

  const cache = {}
  const generate = memoizeByUrl((url, directoryRelativeUrl) => {
    const name = urlToFilename(url)
    let names = cache[directoryRelativeUrl]
    if (!names) {
      names = []
      cache[directoryRelativeUrl] = names
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
    if (directoryRelativeUrl === "/") {
      return {
        buildRelativeUrl: nameCandidate,
        buildUrl: `${baseUrl}${nameCandidate}`,
      }
    }
    return {
      buildRelativeUrl: `${directoryRelativeUrl}${nameCandidate}`,
      buildUrl: `${baseUrl}${directoryRelativeUrl}${nameCandidate}`,
    }
  })

  return {
    generate,
  }
}

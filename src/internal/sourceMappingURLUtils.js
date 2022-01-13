import { urlToOrigin, urlToPathname } from "@jsenv/filesystem"

export const generateSourcemapUrl = (url) => {
  // we want to remove eventual search params from url
  const origin = urlToOrigin(url)
  const pathname = urlToPathname(url)
  const sourcemapUrl = `${origin}${pathname}.map`
  return sourcemapUrl
}

export const getJavaScriptSourceMappingUrl = (javaScriptSource) => {
  let sourceMappingUrl
  replaceSourceMappingUrl(
    javaScriptSource,
    javascriptSourceMappingUrlCommentRegexp,
    (value) => {
      sourceMappingUrl = value
    },
  )
  return sourceMappingUrl
}

export const setJavaScriptSourceMappingUrl = (
  javaScriptSource,
  sourceMappingFileUrl,
) => {
  let replaced
  const sourceAfterReplace = replaceSourceMappingUrl(
    javaScriptSource,
    javascriptSourceMappingUrlCommentRegexp,
    () => {
      replaced = true
      return sourceMappingFileUrl
        ? writeJavaScriptSourceMappingURL(sourceMappingFileUrl)
        : ""
    },
  )
  if (replaced) {
    return sourceAfterReplace
  }

  return sourceMappingFileUrl
    ? `${javaScriptSource}
${writeJavaScriptSourceMappingURL(sourceMappingFileUrl)}`
    : javaScriptSource
}

export const getCssSourceMappingUrl = (cssSource) => {
  let sourceMappingUrl
  replaceSourceMappingUrl(
    cssSource,
    cssSourceMappingUrlCommentRegExp,
    (value) => {
      sourceMappingUrl = value
    },
  )
  return sourceMappingUrl
}

export const setCssSourceMappingUrl = (cssSource, sourceMappingFileUrl) => {
  let replaced
  const sourceAfterReplace = replaceSourceMappingUrl(
    cssSource,
    cssSourceMappingUrlCommentRegExp,
    () => {
      replaced = true
      return sourceMappingFileUrl
        ? writeCssSourceMappingUrl(sourceMappingFileUrl)
        : ""
    },
  )
  if (replaced) {
    return sourceAfterReplace
  }
  return sourceMappingFileUrl
    ? `${cssSource}
${writeCssSourceMappingUrl(sourceMappingFileUrl)}`
    : cssSource
}

const javascriptSourceMappingUrlCommentRegexp =
  /\/\/ ?# ?sourceMappingURL=([^\s'"]+)/g
const cssSourceMappingUrlCommentRegExp =
  /\/\*# ?sourceMappingURL=([^\s'"]+) \*\//g

// ${"//#"} is to avoid a parser thinking there is a sourceMappingUrl for this file
const writeJavaScriptSourceMappingURL = (value) =>
  `${"//#"} sourceMappingURL=${value}`
const writeCssSourceMappingUrl = (value) => `/*# sourceMappingURL=${value} */`

export const sourcemapToBase64Url = (sourcemap) => {
  const asBase64 = Buffer.from(JSON.stringify(sourcemap)).toString("base64")
  return `data:application/json;charset=utf-8;base64,${asBase64}`
}

const replaceSourceMappingUrl = (source, regexp, callback) => {
  let lastSourceMappingUrl
  let matchSourceMappingUrl
  while ((matchSourceMappingUrl = regexp.exec(source))) {
    lastSourceMappingUrl = matchSourceMappingUrl
  }
  if (lastSourceMappingUrl) {
    const index = lastSourceMappingUrl.index
    const before = source.slice(0, index)
    const after = source.slice(index)
    const mappedAfter = after.replace(regexp, (match, firstGroup) => {
      return callback(firstGroup)
    })
    return `${before}${mappedAfter}`
  }
  return source
}

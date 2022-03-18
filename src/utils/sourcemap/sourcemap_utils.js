export const generateSourcemapUrl = (url) => {
  // we want to remove eventual search params from url
  const urlString = String(url)
  const urlObject = new URL(url)
  const origin = urlString.startsWith("file://") ? "file://" : urlObject.origin
  const pathname = urlObject.pathname
  const sourcemapUrl = `${origin}${pathname}.map`
  return sourcemapUrl
}

export const parseJavaScriptSourcemapComment = (javaScriptSource) => {
  let sourceMappingUrl
  replaceSourceMappingUrl(
    javaScriptSource,
    javascriptSourceMappingUrlCommentRegexp,
    (value) => {
      sourceMappingUrl = value
    },
  )
  if (!sourceMappingUrl) {
    return null
  }
  return {
    type: "js_sourcemap_comment",
    // we assume it's on last line
    line: javaScriptSource.split(/\r?\n/).length,
    // ${"//#"} is to avoid static analysis to think there is a sourceMappingUrl for this file
    column: `${"//#"} sourceMappingURL=`.length + 1,
    specifier: sourceMappingUrl,
  }
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

export const parseCssSourcemapComment = (cssSource) => {
  let sourceMappingUrl
  replaceSourceMappingUrl(
    cssSource,
    cssSourceMappingUrlCommentRegExp,
    (value) => {
      sourceMappingUrl = value
    },
  )
  if (!sourceMappingUrl) {
    return null
  }
  return {
    type: "css_sourcemap_comment",
    // we assume it's on last line
    line: cssSource.split(/\r?\n/).length - 1,
    // ${"//*#"} is to avoid static analysis to think there is a sourceMappingUrl for this file
    column: `${"//*#"} sourceMappingURL=`.length + 1,
    specifier: sourceMappingUrl,
  }
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

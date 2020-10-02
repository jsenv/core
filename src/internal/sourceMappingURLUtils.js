export const getJavaScriptSourceMappingUrl = (javaScriptSource) => {
  let sourceMappingUrl
  replaceSourceMappingUrl(javaScriptSource, javascriptSourceMappingUrlCommentRegexp, (value) => {
    sourceMappingUrl = value
  })
  return parseSourceMappingUrl(sourceMappingUrl)
}

export const getCssSourceMappingUrl = (cssSource) => {
  let sourceMappingUrl
  replaceSourceMappingUrl(cssSource, javascriptSourceMappingUrlCommentRegexp, (value) => {
    sourceMappingUrl = value
  })
  return parseSourceMappingUrl(sourceMappingUrl)
}

export const setJavaScriptSourceMappingUrl = (javaScriptSource, sourceMappingFileUrl) => {
  let replaced
  const sourceAfterReplace = replaceSourceMappingUrl(
    javaScriptSource,
    javascriptSourceMappingUrlCommentRegexp,
    () => {
      replaced = true
      return writeJavaScriptSourceMappingURL(sourceMappingFileUrl)
    },
  )
  if (replaced) {
    return sourceAfterReplace
  }
  return `${javaScriptSource}
${writeJavaScriptSourceMappingURL(sourceMappingFileUrl)}`
}

export const setCssSourceMappingUrl = (cssSource, sourceMappingFileUrl) => {
  let replaced
  const sourceAfterReplace = replaceSourceMappingUrl(
    cssSource,
    cssSourceMappingUrlCommentRegExp,
    () => {
      replaced = true
      return writeCssSourceMappingUrl(sourceMappingFileUrl)
    },
  )
  if (replaced) {
    return sourceAfterReplace
  }
  return `${cssSource}
${writeCssSourceMappingUrl(sourceMappingFileUrl)}`
}

export const sourcemapToBase64Url = (sourcemap) => {
  const asBase64 = Buffer.from(JSON.stringify(sourcemap)).toString("base64")
  return `data:application/json;charset=utf-8;base64,${asBase64}`
}

const parseSourceMappingUrl = (sourceMappingUrl) => {
  if (!sourceMappingUrl) {
    return null
  }

  const base64Prefix = "data:application/json;charset=utf-8;base64,"
  if (sourceMappingUrl.startsWith(base64Prefix)) {
    const mapBase64Source = sourceMappingUrl.slice(base64Prefix.length)
    const sourcemapString = base64ToString(mapBase64Source)
    return {
      sourcemapString,
    }
  }

  return {
    sourcemapURL: sourceMappingUrl,
  }
}

const base64ToString =
  typeof window === "object"
    ? window.btoa
    : (base64String) => Buffer.from(base64String, "base64").toString("utf8")

const javascriptSourceMappingUrlCommentRegexp = /\/\/# ?sourceMappingURL=([^\s'"]+)/g
const cssSourceMappingUrlCommentRegExp = /\/\*# ?sourceMappingURL=([^\s'"]+) \*\//g

// ${"//#"} is to avoid a parser thinking there is a sourceMappingUrl for this file
const writeJavaScriptSourceMappingURL = (value) => `${"//#"} sourceMappingURL=${value}`
const writeCssSourceMappingUrl = (value) => `/*# sourceMappingURL=${value} */`

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

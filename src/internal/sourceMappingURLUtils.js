export const writeSourceMappingURL = (source, location) => `${source}
${"//#"} sourceMappingURL=${location}`

export const updateSourceMappingURL = (source, callback) => {
  const sourceMappingUrlRegExp = /\/\/# ?sourceMappingURL=([^\s'"]+)/g
  let lastSourceMappingUrl
  let matchSourceMappingUrl
  while ((matchSourceMappingUrl = sourceMappingUrlRegExp.exec(source))) {
    lastSourceMappingUrl = matchSourceMappingUrl
  }
  if (lastSourceMappingUrl) {
    const index = lastSourceMappingUrl.index
    const before = source.slice(0, index)
    const after = source.slice(index)
    const mappedAfter = after.replace(sourceMappingUrlRegExp, (match, firstGroup) => {
      return `${"//#"} sourceMappingURL=${callback(firstGroup)}`
    })
    return `${before}${mappedAfter}`
  }
  return source
}

export const readSourceMappingURL = (source) => {
  let sourceMappingURL
  updateSourceMappingURL(source, (value) => {
    sourceMappingURL = value
  })
  return sourceMappingURL
}

export const parseSourceMappingURL = (source) => {
  const sourceMappingURL = readSourceMappingURL(source)

  if (!sourceMappingURL) return null

  const base64Prefix = "data:application/json;charset=utf-8;base64,"
  if (sourceMappingURL.startsWith(base64Prefix)) {
    const mapBase64Source = sourceMappingURL.slice(base64Prefix.length)
    const sourcemapString = Buffer.from(mapBase64Source, "base64").toString("utf8")
    return { sourcemapString }
  }

  return {
    sourcemapURL: sourceMappingURL,
  }
}

export const writeOrUpdateSourceMappingURL = (source, location) => {
  if (readSourceMappingURL(source)) {
    return updateSourceMappingURL(source, location)
  }
  return writeSourceMappingURL(source, location)
}

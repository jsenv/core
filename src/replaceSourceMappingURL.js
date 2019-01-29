// here we can do stuff like window.System.prototype.instantiate = stuff
export const replaceSourceMappingURL = (source, callback) => {
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
  replaceSourceMappingURL(source, (value) => {
    sourceMappingURL = value
  })
  return sourceMappingURL
}

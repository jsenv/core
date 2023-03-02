export const responseUsesLongTermCaching = (responseInCache) => {
  const cacheControlResponseHeader =
    responseInCache.headers.get("cache-control")
  const maxAge = parseMaxAge(cacheControlResponseHeader)
  return maxAge && maxAge > 0
}
// https://github.com/tusbar/cache-control
const parseMaxAge = (cacheControlHeader) => {
  if (!cacheControlHeader || cacheControlHeader.length === 0) {
    return null
  }
  const HEADER_REGEXP =
    /([a-zA-Z][a-zA-Z_-]*)\s*(?:=(?:"([^"]*)"|([^ \t",;]*)))?/g
  const matches = cacheControlHeader.match(HEADER_REGEXP) || []
  const values = {}
  Array.from(matches).forEach((match) => {
    const tokens = match.split("=", 2)

    const [key] = tokens
    let value = null

    if (tokens.length > 1) {
      value = tokens[1].trim()
    }

    values[key.toLowerCase()] = value
  })
  return parseDuration(values["max-age"])
}
const parseDuration = (value) => {
  if (!value) {
    return null
  }
  const duration = Number.parseInt(value, 10)
  if (!Number.isFinite(duration) || duration < 0) {
    return null
  }
  return duration
}

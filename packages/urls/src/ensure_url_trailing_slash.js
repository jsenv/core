export const ensureUrlTrailingSlash = (url) => {
  return url.endsWith("/") ? url : `${url}/`
}

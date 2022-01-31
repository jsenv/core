import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"

export const fetchSource = (url, options) => {
  return fetchUrl(url, {
    ignoreHttpsError: true,
    ...options,
  })
}

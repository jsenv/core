import { fetchUrl } from "../fetchUrl.js"

export const fetchSource = (url, options) => {
  return fetchUrl(url, {
    ignoreHttpsError: true,
    options,
  })
}

import { fetchUrl } from "../browser-utils/fetch-browser.js"

export const importJson = async (url, options = {}) => {
  const response = await fetchUrl(url, options)
  const object = await response.json()
  return object
}

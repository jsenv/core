import { browserFetch } from "./fetch_browser.js"

export const fetchJson = async (url, options = {}) => {
  const response = await browserFetch(url, options)
  const object = await response.json()
  return object
}

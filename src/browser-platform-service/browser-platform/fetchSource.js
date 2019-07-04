import { fetchUsingXHR } from "./fetchUsingXHR.js"

export const fetchSource = ({ href }) => {
  return fetchUsingXHR(href, {
    // "x-module-referer": importerHref || href,
  })
}

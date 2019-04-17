import { fetchUsingXHR } from "./fetchUsingXHR.js"

export const fetchSource = ({ href, importerHref }) => {
  return fetchUsingXHR(href, {
    "x-module-referer": importerHref || href,
  })
}

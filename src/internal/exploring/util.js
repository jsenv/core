import { fetchUrl } from "./fetching.js"

export const loadExploringConfig = async () => {
  const exploringJsonResponse = await fetchUrl("/exploring.json", {
    headers: { "x-jsenv-exploring": "1" },
  })
  const exploringConfig = await exploringJsonResponse.json()
  return exploringConfig
}

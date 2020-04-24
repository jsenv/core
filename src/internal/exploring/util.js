import { fetchUsingXHR } from "../fetchUsingXHR.js"

export const loadExploringConfig = async () => {
  const exploringJsonResponse = await fetchUsingXHR("/exploring.json", {
    headers: { "x-jsenv-exploring": "1" },
  })
  const exploringConfig = await exploringJsonResponse.json()
  return exploringConfig
}

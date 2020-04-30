import { fetchUrl } from "./fetching.js"

export const loadExploringConfig = async () => {
  const exploringJsonResponse = await fetchUrl("/exploring.json", {
    headers: { "x-jsenv-exploring": "1" },
  })
  try {
    const exploringConfig = await exploringJsonResponse.json()
    return exploringConfig
  } catch (e) {
    throw new Error(`Cannot communicate with exploring server due to a network error
--- error stack ---
${e.stack}`)
  }
}

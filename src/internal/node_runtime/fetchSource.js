import { fetchUrl } from "../fetchUrl.js"

export const fetchSource = (url, { executionId } = {}) => {
  return fetchUrl(url, {
    ignoreHttpsError: true,
    headers: {
      ...(executionId ? { "x-jsenv-execution-id": executionId } : {}),
    },
  })
}

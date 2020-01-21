import { fetchUrl } from "internal/fetchUrl.js"

export const fetchSource = ({ url, executionId }) => {
  return fetchUrl(url, {
    headers: {
      ...(executionId ? { "x-jsenv-execution-id": executionId } : {}),
    },
  })
}

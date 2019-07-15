import { fetchUsingXHR } from "./fetchUsingXHR.js"

export const fetchSource = ({ href, executionId }) => {
  return fetchUsingXHR(href, {
    credentials: "include",
    headers: {
      ...(executionId ? { "x-jsenv-execution-id": executionId } : {}),
    },
  })
}

import { fetchUsingXHR } from "../../../fetchUsingXHR.js"

export const fetchSource = ({ url, executionId }) => {
  return fetchUsingXHR(url, {
    credentials: "include",
    headers: {
      ...(executionId ? { "x-jsenv-execution-id": executionId } : {}),
    },
  })
}

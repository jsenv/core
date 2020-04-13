import { globalAgent } from "https"
import { fetchUrl as serverFetchUrl } from "@jsenv/server"

// ideally we should only pass this to the fetch below
globalAgent.options.rejectUnauthorized = false

export const fetchUrl = async (
  url,
  { simplified = false, ignoreHttpsError = true, ...rest } = {},
) => {
  return serverFetchUrl(url, { simplified, ignoreHttpsError, ...rest })
}

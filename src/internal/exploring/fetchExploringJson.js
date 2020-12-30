import { createDetailedMessage } from "@jsenv/logger"
import { isCancelError } from "@jsenv/cancellation/main.browser.js"
import { fetchUrl } from "../fetch-browser.js"

export const fetchExploringJson = async ({ cancellationToken } = {}) => {
  try {
    const exploringJsonResponse = await fetchUrl("/.jsenv/exploring.json", {
      headers: { "x-jsenv": "1" },
      cancellationToken,
    })
    const exploringConfig = await exploringJsonResponse.json()
    return exploringConfig
  } catch (e) {
    if (isCancelError(e)) {
      throw e
    }
    throw new Error(
      createDetailedMessage(`Cannot communicate with exploring server due to a network error`, {
        ["error stack"]: e.stack,
      }),
    )
  }
}

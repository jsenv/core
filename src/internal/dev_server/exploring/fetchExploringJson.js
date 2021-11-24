import { createDetailedMessage } from "@jsenv/logger"

import { fetchJson } from "../../browser-utils/fetchJson.js"

export const fetchExploringJson = async ({ signal } = {}) => {
  try {
    const exploringInfo = await fetchJson("/.jsenv/exploring.json", {
      signal,
    })
    return exploringInfo
  } catch (e) {
    if (signal && signal.aborted && e.name === "AbortError") {
      throw e
    }
    throw new Error(
      createDetailedMessage(
        `Cannot communicate with exploring server due to a network error`,
        {
          ["error stack"]: e.stack,
        },
      ),
    )
  }
}

import { isCancelError } from "@jsenv/cancellation"
import { fetchUrl } from "./fetching.js"

export const loadExploringConfig = async ({ cancellationToken }) => {
  try {
    const exploringJsonResponse = await fetchUrl("/exploring.json", {
      headers: { "x-jsenv-exploring": "1" },
      cancellationToken,
    })
    const exploringConfig = await exploringJsonResponse.json()
    return exploringConfig
  } catch (e) {
    if (isCancelError(e)) {
      throw e
    }
    throw new Error(`Cannot communicate with exploring server due to a network error
--- error stack ---
${e.stack}`)
  }
}

export const createPromiseAndHooks = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  promise.resolve = resolve
  promise.reject = reject
  return promise
}

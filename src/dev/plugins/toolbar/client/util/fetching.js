import { memoize } from "@jsenv/core/src/utils/memoize.js"

const fetchPolyfill = async (...args) => {
  const { fetchUsingXHR } = await loadPolyfill()
  return fetchUsingXHR(...args)
}

const loadPolyfill = memoize(() => import("./fetch_using_xhr.js"))

export const fetchUrl =
  typeof window.fetch === "function" &&
  typeof window.AbortController === "function"
    ? window.fetch
    : fetchPolyfill

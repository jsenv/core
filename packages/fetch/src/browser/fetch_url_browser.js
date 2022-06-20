import { fetchUsingXHR } from "./fetch_using_xhr.js"
import { fetchUsingFetch } from "./fetch_using_fetch.js"

export const fetchUrl =
  typeof window.fetch === "function" &&
  typeof window.AbortController === "function"
    ? fetchUsingFetch
    : fetchUsingXHR

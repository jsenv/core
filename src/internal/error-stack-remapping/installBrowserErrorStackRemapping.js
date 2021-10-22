/* eslint-env browser */

import { installErrorStackRemapping } from "./installErrorStackRemapping.js"

export const installBrowserErrorStackRemapping = (options = {}) =>
  installErrorStackRemapping({
    fetchFile: async (url) => {
      // browser having Error.captureStackTrace got window.fetch
      // and this executes only when Error.captureStackTrace exists
      // so no need for polyfill or whatever here
      const response = await window.fetch(url, {
        // by default a script tag is in "no-cors"
        // so we also fetch url with "no-cors"
        mode: "no-cors",
      })
      // we read response test before anything because once memoized fetch
      // gets annoying preventing you to read
      // body multiple times, even using response.clone()
      const text = await response.text()
      return {
        status: response.status,
        url: response.url,
        statusText: response.statusText,
        headers: responseToHeaders(response),
        text: () => text,
        json: response.json.bind(response),
        blob: response.blob.bind(response),
        arrayBuffer: response.arrayBuffer.bind(response),
      }
    },
    resolveFile: (specifier, importer = window.location.href) => {
      // browsers having Error.captureStrackTrace got window.URL
      // and this executes only when Error.captureStackTrace exists
      return String(new URL(specifier, importer))
    },
    ...options,
  })

const responseToHeaders = (response) => {
  const headers = {}
  response.headers.forEach((value, name) => {
    headers[name] = value
  })
  return headers
}

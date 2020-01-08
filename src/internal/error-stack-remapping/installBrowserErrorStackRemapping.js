import { installErrorStackRemapping } from "./installErrorStackRemapping.js"

export const installBrowserErrorStackRemapping = (options = {}) =>
  installErrorStackRemapping({
    fetchFile: async (url) => {
      const response = await fetch(url)
      // we read response test before anything because once memoized fetch
      // gets annoying preventing you to read
      // body multiple times, even using response.clone()
      const text = await response.text()
      return {
        status: response.status,
        body: text,
      }
    },
    baseUrl: window.location.href,
    ...options,
  })

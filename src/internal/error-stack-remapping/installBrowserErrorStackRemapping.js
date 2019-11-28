import { installErrorStackRemapping } from "./installErrorStackRemapping.js"

export const installBrowserErrorStackRemapping = (options) =>
  installErrorStackRemapping({
    fetchFile: async (url) => {
      const response = await fetch(url)
      const text = await response.text()
      return {
        status: response.status,
        // because once memoized fetch
        // gets annoying preventing you to read
        // body multiple times, even using response.clone()
        body: () => text,
      }
    },
    ...options,
  })

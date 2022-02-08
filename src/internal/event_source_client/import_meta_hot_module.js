/*
 * https://vitejs.dev/guide/api-hmr.html#hot-accept-deps-cb
 * https://modern-web.dev/docs/dev-server/plugins/hmr/
 */

export const urlHotMetas = {}

export default (url) => {
  const data = {}

  return {
    data,
    accept: (firstArg, secondArg) => {
      if (!firstArg) {
        urlHotMetas[url] = {
          dependencies: [url],
          acceptCallback: () => {},
        }
        return
      }
      if (typeof firstArg === "function") {
        urlHotMetas[url] = {
          dependencies: [url],
          acceptCallback: firstArg,
        }
        return
      }
      if (typeof firstArg === "string") {
        urlHotMetas[url] = {
          dependencies: [firstArg],
          acceptCallback: secondArg,
        }
        return
      }
      if (Array.isArray(firstArg)) {
        urlHotMetas[url] = {
          dependencies: firstArg,
          acceptCallback: secondArg,
        }
        return
      }
      throw new Error(`invalid call to hot.accept()`)
    },
    dispose: (callback) => {
      urlHotMetas[url] = {
        disposeCallback: () => {
          return callback(data)
        },
      }
    },
    decline: () => {
      urlHotMetas[url] = "decline"
    },
    invalidate: () => {
      urlHotMetas[url] = "invalid"
    },
  }
}

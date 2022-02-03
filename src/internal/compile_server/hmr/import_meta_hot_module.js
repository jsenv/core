/*
 * https://vitejs.dev/guide/api-hmr.html#hot-accept-deps-cb
 * https://modern-web.dev/docs/dev-server/plugins/hmr/
 */

/* eslint-env browser */

export default (url) => {
  const data = {}
  const { reloadMetas } = window.__jsenv_event_source_client__

  return {
    data,
    accept: (firstArg, secondArg) => {
      // TODO: the dependencies must be resolved againt url
      if (!firstArg) {
        reloadMetas[url] = {
          dependencies: [url],
          reloadCallback: () => {},
        }
        return
      }
      if (typeof firstArg === "function") {
        reloadMetas[url] = {
          dependencies: [url],
          reloadCallback: firstArg,
        }
        return
      }
      if (typeof firstArg === "string") {
        reloadMetas[url] = {
          dependencies: [firstArg],
          reloadCallback: secondArg,
        }
        return
      }
      if (Array.isArray(firstArg)) {
        reloadMetas[url] = {
          dependencies: firstArg,
          reloadCallback: secondArg,
        }
        return
      }
      throw new Error(`invalid call to hot.accept()`)
    },
    dispose: (callback) => {
      reloadMetas[url] = {
        disposeCallback: () => {
          return callback(data)
        },
      }
    },
    decline: () => {
      reloadMetas[url] = "decline"
    },
    invalidate: () => {
      reloadMetas[url] = "invalid"
    },
  }
}

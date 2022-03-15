/*
 * https://vitejs.dev/guide/api-hmr.html#hot-accept-deps-cb
 * https://modern-web.dev/docs/dev-server/plugins/hmr/
 */

export const urlHotMetas = {}

export const createImportMetaHot = (url) => {
  const data = {}

  return {
    data,
    accept: (firstArg, secondArg) => {
      if (!firstArg) {
        addUrlMeta(url, {
          dependencies: [url],
          acceptCallback: () => {},
        })
        return
      }
      if (typeof firstArg === "function") {
        addUrlMeta(url, {
          dependencies: [url],
          acceptCallback: firstArg,
        })
        return
      }
      if (typeof firstArg === "string") {
        addUrlMeta(url, {
          dependencies: [firstArg],
          acceptCallback: secondArg,
        })
        return
      }
      if (Array.isArray(firstArg)) {
        addUrlMeta(url, {
          dependencies: firstArg,
          acceptCallback: secondArg,
        })
        return
      }
      throw new Error(`invalid call to hot.accept()`)
    },
    dispose: (callback) => {
      addUrlMeta(url, {
        disposeCallback: () => {
          return callback(data)
        },
      })
    },
    decline: () => {
      addUrlMeta(url, {
        declined: true,
      })
    },
    invalidate: () => {
      addUrlMeta(url, {
        invalidated: true,
      })
    },
  }
}

const addUrlMeta = (url, meta) => {
  const urlWithoutHmrQuery = asUrlWithoutHmrQuery(url)
  urlHotMetas[urlWithoutHmrQuery] = {
    ...urlHotMetas[urlWithoutHmrQuery],
    ...meta,
  }
}

const asUrlWithoutHmrQuery = (url) => {
  const urlObject = new URL(url)
  urlObject.searchParams.delete("hmr")
  return urlObject.href
}

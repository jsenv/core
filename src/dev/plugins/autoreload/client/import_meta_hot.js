/*
 * https://vitejs.dev/guide/api-hmr.html#hot-accept-deps-cb
 * https://modern-web.dev/docs/dev-server/plugins/hmr/
 */

export const urlHotMetas = {}

export const createImportMetaHot = (importMetaUrl) => {
  const data = {}
  const url = asUrlWithoutHmrQuery(importMetaUrl)

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
      throw new Error(
        `invalid call to import.meta.hot.accept(), received ${firstArg}`,
      )
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
  urlHotMetas[url] = {
    ...urlHotMetas[url],
    ...meta,
  }
}

const asUrlWithoutHmrQuery = (url) => {
  const urlObject = new URL(url)
  if (urlObject.searchParams.has("hmr")) {
    urlObject.searchParams.delete("hmr")
    urlObject.searchParams.delete("v")
    return urlObject.href
  }
  return url
}

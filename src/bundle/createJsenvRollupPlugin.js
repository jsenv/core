import { resolve } from "url"
import { fileRead } from "@dmail/helper"
import { createOperation } from "@dmail/cancellation"
import { resolveImport, pathnameToFileHref, fileHrefToPathname } from "@jsenv/module-resolution"
import { fetchUsingHttp } from "../platform/node/fetchUsingHttp.js"
import { readSourceMappingURL } from "../replaceSourceMappingURL.js"

export const createJsenvRollupPlugin = ({ cancellationToken, projectFolder }) => {
  const rollupJsenvPlugin = {
    name: "jsenv",
    resolveId: (importee, importer) => {
      const rootHref = pathnameToFileHref(projectFolder)
      // hotfix because entry file has no importer
      // so it would be resolved against root which is a folder
      // and url resolution would not do what we expect
      if (!importer) return `${rootHref}/${importee}`

      const id = resolveImport({
        root: rootHref,
        importer,
        specifier: importee,
      })
      return id
    },

    load: async (href) => {
      const source = await fetchHref(href)

      const sourceMappingURL = readSourceMappingURL(source)
      if (!sourceMappingURL) return { code: source }

      const base64Prefix = "data:application/json;charset=utf-8;base64,"
      if (sourceMappingURL.startsWith(base64Prefix)) {
        const mapBase64Source = sourceMappingURL.slice(base64Prefix.length)
        const mapSource = new Buffer(mapBase64Source, "base64").toString("utf8")
        return { code: source, map: JSON.parse(mapSource) }
      }

      const resolvedSourceMappingURL = resolve(href, sourceMappingURL)
      const mapSource = await fetchHref(resolvedSourceMappingURL)

      return { code: source, map: JSON.parse(mapSource) }
    },
  }

  const fetchHref = async (href) => {
    // this code allow you to have http/https dependency for convenience
    // but maybe we should warn about this.
    // it could also be vastly improved using a basic in memory cache
    if (href.startsWith("http://")) {
      const response = await fetchUsingHttp(href, { cancellationToken })
      ensureResponseSuccess(response)
      return response.body
    }
    if (href.startsWith("https://")) {
      const response = await fetchUsingHttp(href, { cancellationToken })
      ensureResponseSuccess(response)
      return response.body
    }
    if (href.startsWith("file:///")) {
      const code = await createOperation({
        cancellationToken,
        start: () => fileRead(fileHrefToPathname(href)),
      })
      return code
    }

    return ""
  }

  const ensureResponseSuccess = ({ url, status }) => {
    if (status < 200 || status > 299) {
      throw new Error(`unexpected response status for ${url}, got ${status}`)
    }
  }

  return rollupJsenvPlugin
}

import { resolve } from "url"
import { fileRead } from "/node_modules/@dmail/helper/index.js"
import { createOperation } from "/node_modules/@dmail/cancellation/index.js"
import {
  resolveImport,
  remapResolvedImport,
  hrefToPathname,
  hrefToScheme,
} from "/node_modules/@jsenv/module-resolution/index.js"
import { fetchUsingHttp } from "../platform/node/fetchUsingHttp.js"
import { readSourceMappingURL } from "../replaceSourceMappingURL.js"

export const createJsenvRollupPlugin = ({
  cancellationToken,
  importMap = {},
  projectFolder,
  origin = "http://example.com",
}) => {
  const rollupJsenvPlugin = {
    name: "jsenv",

    resolveId: (importee, importer) => {
      let importerHref
      if (importer) {
        // importer will be a pathname
        // except if you have an absolute dependency like import 'http://domain.com/file.js'
        // so when needed convert importer back to an url
        if (importer.startsWith(`${projectFolder}/`)) {
          importerHref = `${origin}${importer.slice(projectFolder.length)}`
        } else if (hrefToScheme(importer) === "") {
          importerHref = `${origin}${importer}`
        } else {
          importerHref = importer
        }
      } else {
        // hotfix because entry file has no importer
        // so it would be resolved against root which is a folder
        // and url resolution would not do what we expect
        importerHref = `${origin}${projectFolder}`
      }

      const resolvedImport = resolveImport({
        importer: importerHref,
        specifier: importee,
      })

      const id = remapResolvedImport({
        importMap,
        importerHref,
        resolvedImport,
      })

      // rollup works with pathname
      // le'sreturn himpathname when possible
      // otherwise sourcemap.sources will be messed up
      if (id.startsWith(`${origin}/`)) {
        const filename = `${projectFolder}${hrefToPathname(id)}`
        return filename
      }

      return id
    },

    load: async (id) => {
      const href = id[0] === "/" ? `file://${id}` : id
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
        start: () => fileRead(hrefToPathname(href)),
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

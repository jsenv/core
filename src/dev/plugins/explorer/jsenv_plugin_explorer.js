import { readFileSync } from "node:fs"
import { collectFiles, normalizeStructuredMetaMap } from "@jsenv/filesystem"

import { DataUrl } from "@jsenv/utils/urls/data_url.js"
import { CONTENT_TYPE } from "@jsenv/utils/content_type/content_type.js"

export const jsenvPluginExplorer = ({ groups }) => {
  const htmlClientFileUrl = new URL("./client/explorer.html", import.meta.url)
  const faviconClientFileUrl = new URL("./client/jsenv.png", import.meta.url)

  return {
    name: "jsenv:explorer",
    appliesDuring: {
      dev: true,
    },
    serve: async (request, { rootDirectoryUrl }) => {
      if (request.ressource !== "/") {
        return null
      }
      const structuredMetaMapRelativeForExplorable = {}
      Object.keys(groups).forEach((groupName) => {
        const groupConfig = groups[groupName]
        structuredMetaMapRelativeForExplorable[groupName] = {
          "**/.jsenv/": false, // avoid visting .jsenv directory in jsenv itself
          ...groupConfig,
        }
      })
      const structuredMetaMapForExplorable = normalizeStructuredMetaMap(
        structuredMetaMapRelativeForExplorable,
        rootDirectoryUrl,
      )
      const matchingFileResultArray = await collectFiles({
        directoryUrl: rootDirectoryUrl,
        structuredMetaMap: structuredMetaMapForExplorable,
        predicate: (meta) =>
          Object.keys(meta).some((group) => Boolean(meta[group])),
      })
      const files = matchingFileResultArray.map(({ relativeUrl, meta }) => ({
        relativeUrl,
        meta,
      }))
      let html = String(readFileSync(new URL(htmlClientFileUrl)))
      html = html.replace(
        "FAVICON_HREF",
        DataUrl.stringify({
          contentType: CONTENT_TYPE.fromUrlExtension(faviconClientFileUrl),
          base64Flag: true,
          data: readFileSync(new URL(faviconClientFileUrl)).toString("base64"),
        }),
      )
      html = html.replace(
        "SERVER_PARAMS",
        JSON.stringify(
          {
            rootDirectoryUrl,
            groups,
            files,
          },
          null,
          "  ",
        ),
      )
      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "text/html",
          "content-length": Buffer.byteLength(html),
        },
        body: html,
      }
    },
  }
}

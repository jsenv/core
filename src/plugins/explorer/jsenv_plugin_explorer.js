import { readFileSync } from "node:fs"
import { DATA_URL } from "@jsenv/urls"
import { collectFiles } from "@jsenv/filesystem"
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js"

export const jsenvPluginExplorer = ({ groups }) => {
  const htmlClientFileUrl = new URL("./client/explorer.html", import.meta.url)
  const faviconClientFileUrl = new URL("./client/jsenv.png", import.meta.url)

  return {
    name: "jsenv:explorer",
    appliesDuring: "dev",
    serve: async (request, { rootDirectoryUrl }) => {
      if (request.ressource !== "/") {
        return null
      }
      const associationsForExplorable = {}
      Object.keys(groups).forEach((groupName) => {
        const groupConfig = groups[groupName]
        associationsForExplorable[groupName] = {
          "**/.jsenv/": false, // avoid visting .jsenv directory in jsenv itself
          ...groupConfig,
        }
      })
      const matchingFileResultArray = await collectFiles({
        directoryUrl: rootDirectoryUrl,
        associations: associationsForExplorable,
        predicate: (meta) =>
          Object.keys(meta).some((group) => Boolean(meta[group])),
      })
      const files = matchingFileResultArray.map(({ relativeUrl, meta }) => ({
        relativeUrl,
        meta,
      }))
      let html = String(readFileSync(new URL(htmlClientFileUrl)))
      html = html.replace(
        "ignore:FAVICON_HREF",
        DATA_URL.stringify({
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

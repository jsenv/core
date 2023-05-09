import { readFileSync } from "node:fs"
import { DATA_URL } from "@jsenv/urls"
import { collectFiles } from "@jsenv/filesystem"
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js"

export const explorerHtmlFileUrl = String(
  new URL("./client/explorer.html", import.meta.url),
)

export const jsenvPluginExplorer = ({
  groups = {
    src: {
      "./**/*.html": true,
      "./**/*.test.html": false,
    },
    tests: {
      "./**/*.test.html": true,
    },
  },
}) => {
  const faviconClientFileUrl = new URL("./client/jsenv.png", import.meta.url)

  return {
    name: "jsenv:explorer",
    appliesDuring: "dev",
    transformUrlContent: {
      html: async (urlInfo, context) => {
        if (urlInfo.url !== explorerHtmlFileUrl) {
          return null
        }
        let html = urlInfo.content
        if (html.includes("ignore:FAVICON_HREF")) {
          html = html.replace(
            "ignore:FAVICON_HREF",
            DATA_URL.stringify({
              contentType: CONTENT_TYPE.fromUrlExtension(faviconClientFileUrl),
              base64Flag: true,
              data: readFileSync(new URL(faviconClientFileUrl)).toString(
                "base64",
              ),
            }),
          )
        }
        if (html.includes("SERVER_PARAMS")) {
          const associationsForExplorable = {}
          Object.keys(groups).forEach((groupName) => {
            const groupConfig = groups[groupName]
            associationsForExplorable[groupName] = {
              "**/.jsenv/": false, // avoid visting .jsenv directory in jsenv itself
              ...groupConfig,
            }
          })
          const matchingFileResultArray = await collectFiles({
            directoryUrl: context.rootDirectoryUrl,
            associations: associationsForExplorable,
            predicate: (meta) =>
              Object.keys(meta).some((group) => Boolean(meta[group])),
          })
          const files = matchingFileResultArray.map(
            ({ relativeUrl, meta }) => ({
              relativeUrl,
              meta,
            }),
          )

          html = html.replace(
            "SERVER_PARAMS",
            JSON.stringify(
              {
                rootDirectoryUrl: context.rootDirectoryUrl,
                groups,
                files,
              },
              null,
              "  ",
            ),
          )
          Object.assign(urlInfo.headers, {
            "cache-control": "no-store",
          })
        }
        return html
      },
    },
  }
}

import { readFileSync } from "node:fs"
import { DATA_URL } from "@jsenv/urls"
import { collectFiles } from "@jsenv/filesystem"
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js"

const explorerHtmlFileUrl = new URL("./client/explorer.html", import.meta.url)

export const jsenvPluginExplorer = ({
  mainFileUrl = explorerHtmlFileUrl,
  groups = {
    src: {
      "./src/**/*.html": true,
    },
    tests: {
      "./tests/**/*.test.html": true,
    },
  },
}) => {
  const faviconClientFileUrl = new URL("./client/jsenv.png", import.meta.url)

  return {
    name: "jsenv:explorer",
    appliesDuring: "dev",
    resolveUrl: {
      http_request: (reference) => {
        if (reference.specifier === "/") {
          return String(mainFileUrl)
        }
        return null
      },
    },
    transformUrlContent: {
      html: async (urlInfo, context) => {
        if (urlInfo.url !== explorerHtmlFileUrl) {
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
          directoryUrl: context.rootDirectoryUrl,
          associations: associationsForExplorable,
          predicate: (meta) =>
            Object.keys(meta).some((group) => Boolean(meta[group])),
        })
        const files = matchingFileResultArray.map(({ relativeUrl, meta }) => ({
          relativeUrl,
          meta,
        }))
        let html = urlInfo.content
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
        return html
      },
    },
  }
}

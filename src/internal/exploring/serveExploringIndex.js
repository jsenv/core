import { readFileSync } from "fs"
import {
  collectFiles,
  metaMapToSpecifierMetaMap,
  resolveUrl,
  urlToFileSystemPath,
} from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"

const JSENV_ICON_URL = resolveUrl("src/internal/jsenv.png", jsenvCoreDirectoryUrl)

export const serveExploringIndex = async ({
  projectDirectoryUrl,
  htmlFileRelativeUrl,
  explorableConfig,
}) => {
  const specifierMetaMap = metaMapToSpecifierMetaMap({
    explorable: explorableConfig,
  })

  const matchingFileResultArray = await collectFiles({
    directoryUrl: projectDirectoryUrl,
    specifierMetaMap,
    predicate: ({ explorable }) => explorable,
  })
  const explorableRelativeUrlArray = matchingFileResultArray.map(({ relativeUrl }) => relativeUrl)

  const html = await getBrowsingIndexPageHTML({
    projectDirectoryUrl,
    htmlFileRelativeUrl,
    explorableRelativeUrlArray,
  })

  return {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html",
      "content-length": Buffer.byteLength(html),
    },
    body: html,
  }
}

const getBrowsingIndexPageHTML = async ({
  projectDirectoryUrl,
  htmlFileRelativeUrl,
  explorableRelativeUrlArray,
}) => {
  const jsenvIcon = readFileSync(urlToFileSystemPath(JSENV_ICON_URL))
  const jsenvBase64Data = Buffer.from(jsenvIcon).toString("base64")
  const faviconBase64 = `data:image/png;base64,${jsenvBase64Data}`

  return `<!doctype html>

  <head>
    <meta charset="utf-8" />
    <title>Exploring ${projectDirectoryUrl}</title>
    <link rel="icon" type="image/png" href="${faviconBase64}">
  </head>

  <body>
    <main>
      <h1>${projectDirectoryUrl}</h1>
      <p>List of path to explore: </p>
      <ul>
        ${explorableRelativeUrlArray
          .map(
            (relativeUrl) =>
              `<li><a href="${htmlFileRelativeUrl}?file=${relativeUrl}">${relativeUrl}</a></li>`,
          )
          .join("")}
      </ul>
    </main>
  </body>
  </html>`
}

import { metaMapToSpecifierMetaMap } from "@jsenv/url-meta"
import { collectFiles } from "@jsenv/file-collector"

export const serveExploringIndex = async ({
  projectDirectoryUrl,
  explorableConfig,
  request: { ressource },
}) => {
  if (ressource !== "/") return null

  const specifierMetaMap = metaMapToSpecifierMetaMap({
    explorable: explorableConfig,
  })

  const matchingFileResultArray = await collectFiles({
    directoryPath: projectDirectoryUrl,
    specifierMetaMap,
    predicate: ({ explorable }) => explorable,
  })
  const explorableRelativePathArray = matchingFileResultArray.map(
    ({ relativePath }) => relativePath,
  )

  const html = getBrowsingIndexPageHTML({
    projectDirectoryUrl,
    explorableRelativePathArray,
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

const getBrowsingIndexPageHTML = ({ projectDirectoryUrl, explorableRelativePathArray }) => {
  return `<!doctype html>

  <head>
    <title>Exploring ${projectDirectoryUrl}</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <main>
      <h1>${projectDirectoryUrl}</h1>
      <p>List of path to explore: </p>
      <ul>
        ${explorableRelativePathArray
          .map((relativePath) => `<li><a href="${relativePath}">${relativePath}</a></li>`)
          .join("")}
      </ul>
    </main>
  </body>
  </html>`
}

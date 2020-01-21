import { collectFiles, metaMapToSpecifierMetaMap } from "@jsenv/util"

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

  const html = getBrowsingIndexPageHTML({
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

const getBrowsingIndexPageHTML = ({
  projectDirectoryUrl,
  htmlFileRelativeUrl,
  explorableRelativeUrlArray,
}) => {
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

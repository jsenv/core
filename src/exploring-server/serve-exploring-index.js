import { matchAllFileInsideFolder, sortPathnameArray } from "@dmail/filesystem-matching"

export const serveExploringIndex = async ({
  projectPathname,
  metaDescription,
  request: { ressource },
}) => {
  if (ressource !== "/") return null

  const matchingFileResultArray = await matchAllFileInsideFolder({
    folderPath: projectPathname,
    metaDescription,
    predicate: ({ browsable }) => browsable,
  })
  const browsablePathnameArray = matchingFileResultArray.map(({ relativePath }) => relativePath)

  const html = getBrowsingIndexPageHTML({
    projectPathname,
    browsablePathnameArray,
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

const getBrowsingIndexPageHTML = ({ projectPathname, browsablePathnameArray }) => {
  return `<!doctype html>

  <head>
    <title>Browsing ${projectPathname}</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <main>
      <h1>${projectPathname}</h1>
      <p>List of path to browse: </p>
      <ul>
        ${sortPathnameArray(browsablePathnameArray)
          .map(
            (browsablePathname) =>
              `<li><a href="${browsablePathname}">${browsablePathname}</a></li>`,
          )
          .join("")}
      </ul>
    </main>
  </body>
  </html>`
}

import { selectAllFileInsideFolder } from "@dmail/project-structure"

export const serveBrowsingIndex = async ({
  projectFolder,
  metaDescription,
  request: { ressource },
}) => {
  if (ressource !== "/") return null

  const browsableFilenameRelativeArray = await selectAllFileInsideFolder({
    pathname: projectFolder,
    metaDescription,
    predicate: ({ browsable }) => browsable,
    transformFile: ({ filenameRelative }) => filenameRelative,
  })

  const html = getBrowsingIndexPageHTML({
    projectFolder,
    browsableFilenameRelativeArray,
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

const getBrowsingIndexPageHTML = ({ projectFolder, browsableFilenameRelativeArray }) => {
  return `<!doctype html>

  <head>
    <title>Browsing ${projectFolder}</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <main>
      <h1>${projectFolder}</h1>
      <p>List of path to browse: </p>
      <ul>
        ${browsableFilenameRelativeArray
          .sort()
          .map(
            (filenameRelative) => `<li><a href="/${filenameRelative}">${filenameRelative}</a></li>`,
          )
          .join("")}
      </ul>
    </main>
  </body>
  </html>`
}

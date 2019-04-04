import {
  createOperation,
  createCancellationToken,
} from "/node_modules/@dmail/cancellation/index.js"
import { fileWrite } from "/node_modules/@dmail/helper/index.js"

export const generateEntryPointMapPages = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  into,
  entryPointMap,
}) => {
  await Promise.all(
    Object.keys(entryPointMap).map((entryPointName) => {
      return generateEntryPage({
        cancellationToken,
        projectFolder,
        into,
        entryPointName,
      })
    }),
  )
}

const generateEntryPage = async ({ cancellationToken, projectFolder, into, entryPointName }) => {
  const entryFilenameRelative = `${entryPointName}.js`
  const pageFilenameRelative = `${entryPointName}.html`

  const html = `<!doctype html>

<head>
  <title>Untitled</title>
  <meta charset="utf-8" />
</head>

<body>
  <main></main>
  <script src="./${entryFilenameRelative}"></script>
</body>

</html>`

  await createOperation({
    cancellationToken,
    start: () => fileWrite(`${projectFolder}/${into}/${pageFilenameRelative}`, html),
  })
}

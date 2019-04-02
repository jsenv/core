import { createOperation, createCancellationToken } from "@dmail/cancellation"
import { fileWrite } from "@dmail/helper"

export const generateEntryPointMapPages = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  into,
  entryPointMap,
}) => {
  await Promise.all(
    Object.keys(entryPointMap).map((entryPoint) => {
      return generateEntryPage({
        cancellationToken,
        projectFolder,
        into,
        entryPoint,
      })
    }),
  )
}

const generateEntryPage = async ({ cancellationToken, projectFolder, into, entryPoint }) => {
  const entryFilenameRelative = `${entryPoint}.js`
  const pageFilenameRelative = `${entryPoint}.html`

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

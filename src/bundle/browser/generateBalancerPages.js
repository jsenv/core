import { createOperation, createCancellationToken } from "@dmail/cancellation"
import { fileWrite } from "@dmail/helper"

export const generateBalancerPages = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  into,
  globalName,
  entryPointsDescription,
}) => {
  await Promise.all(
    Object.keys(entryPointsDescription).map((entryName) => {
      return genereateBalancerPage({
        cancellationToken,
        projectFolder,
        into,
        globalName,
        entryName,
      })
    }),
  )
}

const genereateBalancerPage = async ({ cancellationToken, projectFolder, into, entryName }) => {
  const entryFilenameRelative = `${entryName}.js`
  const pageFilenameRelative = `${entryName}.html`

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

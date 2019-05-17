import { createOperation, createCancellationToken } from "@dmail/cancellation"
import { fileWrite } from "@dmail/helper"
import { pathnameToOperatingSystemFilename } from "../../operating-system-filename.js"

export const generateEntryPointMapPages = async ({
  cancellationToken = createCancellationToken(),
  projectPathname,
  bundleIntoRelativePath,
  entryPointMap,
}) => {
  await Promise.all(
    Object.keys(entryPointMap).map((entryPointName) => {
      return generateEntryPage({
        cancellationToken,
        projectPathname,
        bundleIntoRelativePath,
        entryPointName,
      })
    }),
  )
}

const generateEntryPage = async ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  entryPointName,
}) => {
  const entrypathnameRelative = `${entryPointName}.js`
  const pagePath = `/${entryPointName}.html`

  const html = `<!doctype html>

<head>
  <title>Untitled</title>
  <meta charset="utf-8" />
</head>

<body>
  <main></main>
  <script src="./${entrypathnameRelative}"></script>
</body>

</html>`

  await createOperation({
    cancellationToken,
    start: () =>
      fileWrite(
        pathnameToOperatingSystemFilename(`${projectPathname}${bundleIntoRelativePath}${pagePath}`),
        html,
      ),
  })
}

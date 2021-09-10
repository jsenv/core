import { generateContentHash } from "./internal/building/url-versioning.js"

export const jsenvServiceWorkerFinalizer = (
  code,
  { buildManifest, rollupBuild },
  { lineBreakNormalization },
) => {
  const generatedUrlsConfig = {}
  Object.keys(buildManifest).forEach((projectRelativeUrl) => {
    if (projectRelativeUrl.endsWith(".map")) {
      return
    }
    const buildRelativeUrl = buildManifest[projectRelativeUrl]
    const versioned = fileNameContainsHash(buildRelativeUrl)
    const rollupFile = rollupBuild[buildRelativeUrl]

    generatedUrlsConfig[buildRelativeUrl] = {
      versioned,
      ...(versioned
        ? {}
        : {
            // when url is not versioned we compute a "version" for that url anyway
            // so that service worker source still changes and navigator
            // detect there is a change
            version: generateContentHash(
              rollupFile.type === "chunk" ? rollupFile.code : rollupFile.source,
              { lineBreakNormalization },
            ),
          }),
    }
  })

  return `
self.generatedUrlsConfig = ${JSON.stringify(generatedUrlsConfig, null, "  ")}
${code}
`
}

const fileNameContainsHash = (fileName) =>
  /-[a-z0-9]{8,}(\..*?)?$/.test(fileName)

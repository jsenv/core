import { generateAssetHash } from "./computeBuildRelativeUrl.js"

export const generateServiceWorkerCodeToInject = ({ buildManifest, rollupBuild }) => {
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
            version: generateAssetHash(
              rollupFile.type === "chunk" ? rollupFile.code : rollupFile.source,
            ),
          }),
    }
  })

  return `
self.generatedUrlsConfig = ${JSON.stringify(generatedUrlsConfig, null, "  ")}
`
}

const fileNameContainsHash = (fileName) => /-[a-z0-9]{8,}(\..*?)?$/.test(fileName)

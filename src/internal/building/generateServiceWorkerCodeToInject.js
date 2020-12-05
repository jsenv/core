import { generateAssetHash } from "./computeBuildRelativeUrl.js"
import { sortObjectByPathnames } from "./sortObjectByPathnames.js"

export const generateServiceWorkerCodeToInject = ({ buildManifest, rollupBuild }) => {
  const jsenvBuildUrls = []
  const jsenvBuildStaticUrls = []
  let jsenvStaticUrlsHash = {}
  Object.keys(buildManifest).forEach((projectRelativeUrl) => {
    if (projectRelativeUrl.endsWith(".map")) {
      return
    }
    const buildRelativeUrl = buildManifest[projectRelativeUrl]
    jsenvBuildUrls.push(buildRelativeUrl)

    if (!fileNameContainsHash(buildRelativeUrl)) {
      jsenvBuildStaticUrls.push(buildRelativeUrl)
      const rollupFile = rollupBuild[buildRelativeUrl]
      jsenvStaticUrlsHash[buildRelativeUrl] = generateAssetHash(
        rollupFile.type === "chunk" ? rollupFile.code : rollupFile.source,
      )
    }
  })

  // the order of hash is not important, it must be predictable
  // otherwise it could trigger a service worker update even
  // if the file did not change.
  jsenvStaticUrlsHash = sortObjectByPathnames(jsenvStaticUrlsHash)

  return `
self.jsenvBuildUrls = ${JSON.stringify(jsenvBuildUrls, null, "  ")}
self.jsenvBuildStaticUrls = ${JSON.stringify(jsenvBuildStaticUrls, null, "  ")}
self.jsenvStaticUrlsHash = ${JSON.stringify(jsenvStaticUrlsHash, null, "  ")}
`
}

const fileNameContainsHash = (fileName) => /-[a-z0-9]{8,}(\..*?)?$/.test(fileName)

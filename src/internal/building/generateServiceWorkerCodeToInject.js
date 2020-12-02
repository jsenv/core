import { generateAssetHash } from "./computeBuildRelativeUrl.js"
import { sortObjectByPathnames } from "./sortObjectByPathnames.js"

// il ne faudra pas oublier d'y mettre le hash des fichier html
// au cas ou seulement lui soit modifié
export const generateServiceWorkerCodeToInject = (buildManifest, htmlTargets) => {
  const jsenvBuildUrls = []
  Object.keys(buildManifest).forEach((key) => {
    if (key.endsWith(".map")) {
      return
    }
    const buildUrl = buildManifest[key]
    jsenvBuildUrls.push(buildUrl)
  })
  let jsenvStaticUrlsHash = {}
  htmlTargets.forEach((htmlTarget) => {
    jsenvStaticUrlsHash[htmlTarget.buildRelativeUrl] = generateAssetHash(
      htmlTarget.sourceAfterTransformation,
    )
  })
  // the order of hash is not important, it must be predictable
  // otherwise it could trigger a service worker update even
  // if the file did not change.
  jsenvStaticUrlsHash = sortObjectByPathnames(jsenvStaticUrlsHash)

  return `
self.jsenvBuildUrls = ${JSON.stringify(jsenvBuildUrls, null, "  ")}
self.jsenvStaticUrlsHash = ${JSON.stringify(jsenvStaticUrlsHash, null, "  ")}
`
}

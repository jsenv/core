import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { createVersionGenerator } from "@jsenv/utils/versioning/version_generator.js"

import { GRAPH } from "./graph_utils.js"

export const injectServiceWorkerUrls = async ({
  finalGraph,
  finalGraphKitchen,
  lineBreakNormalization,
}) => {
  const serviceWorkerUrlInfos = GRAPH.filter(
    finalGraph,
    (finalUrlInfo) => finalUrlInfo.subtype === "service_worker",
  )
  if (serviceWorkerUrlInfos.length === 0) {
    return
  }
  const serviceWorkerUrls = {}
  GRAPH.forEach(finalGraph, (urlInfo) => {
    if (urlInfo.isInline || urlInfo.external) {
      return
    }
    if (!urlInfo.url.startsWith("file:")) {
      return
    }
    if (urlInfo.data.buildUrlIsVersioned) {
      serviceWorkerUrls[urlInfo.data.buildRelativeUrl] = {
        versioned: true,
      }
      return
    }
    if (!urlInfo.data.version) {
      // when url is not versioned we compute a "version" for that url anyway
      // so that service worker source still changes and navigator
      // detect there is a change
      const versionGenerator = createVersionGenerator()
      versionGenerator.augmentWithContent({
        content: urlInfo.content,
        contentType: urlInfo.contentType,
        lineBreakNormalization,
      })
      const version = versionGenerator.generate()
      urlInfo.data.version = version
    }
    serviceWorkerUrls[urlInfo.data.buildRelativeUrl] = {
      versioned: false,
      version: urlInfo.data.version,
    }
  })
  await Promise.all(
    serviceWorkerUrlInfos.map(async (serviceWorkerUrlInfo) => {
      const magicSource = createMagicSource(serviceWorkerUrlInfo.content)
      const urlsWithoutSelf = {
        ...serviceWorkerUrls,
      }
      delete urlsWithoutSelf[serviceWorkerUrlInfo.data.buildRelativeUrl]
      magicSource.prepend(generateClientCode(urlsWithoutSelf))
      const { content, sourcemap } = magicSource.toContentAndSourcemap()
      await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(
        serviceWorkerUrlInfo,
        {
          content,
          sourcemap,
        },
      )
    }),
  )
}

const generateClientCode = (serviceWorkerUrls) => {
  return `
self.serviceWorkerUrls = ${JSON.stringify(serviceWorkerUrls, null, "  ")};
`
}

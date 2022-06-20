import { createMagicSource } from "@jsenv/sourcemap"
import { createVersionGenerator } from "@jsenv/utils/src/versioning/version_generator.js"

import { GRAPH } from "./graph_utils.js"

export const injectServiceWorkerUrls = async ({
  finalGraph,
  finalGraphKitchen,
  lineBreakNormalization,
}) => {
  const serviceWorkerEntryUrlInfos = GRAPH.filter(
    finalGraph,
    (finalUrlInfo) => {
      return (
        finalUrlInfo.subtype === "service_worker" &&
        finalUrlInfo.data.isWebWorkerEntryPoint
      )
    },
  )
  if (serviceWorkerEntryUrlInfos.length === 0) {
    return
  }
  const serviceWorkerUrls = {}
  GRAPH.forEach(finalGraph, (urlInfo) => {
    if (urlInfo.isInline || !urlInfo.shouldHandle) {
      return
    }
    if (!urlInfo.url.startsWith("file:")) {
      return
    }
    if (urlInfo.data.buildUrlIsVersioned) {
      serviceWorkerUrls[urlInfo.data.buildUrlSpecifier] = {
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
    serviceWorkerUrls[urlInfo.data.buildUrlSpecifier] = {
      versioned: false,
      version: urlInfo.data.version,
    }
  })
  await Promise.all(
    serviceWorkerEntryUrlInfos.map(async (serviceWorkerEntryUrlInfo) => {
      const magicSource = createMagicSource(serviceWorkerEntryUrlInfo.content)
      const urlsWithoutSelf = {
        ...serviceWorkerUrls,
      }
      delete urlsWithoutSelf[serviceWorkerEntryUrlInfo.data.buildUrlSpecifier]
      magicSource.prepend(generateClientCode(urlsWithoutSelf))
      const { content, sourcemap } = magicSource.toContentAndSourcemap()
      await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(
        serviceWorkerEntryUrlInfo,
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

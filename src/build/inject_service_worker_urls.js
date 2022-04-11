import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"

export const injectServiceWorkerUrls = async ({
  urlInfo,
  kitchen,
  serviceWorkerUrls,
}) => {
  const magicSource = createMagicSource(urlInfo.content)
  const urlsWithoutSelf = {
    ...serviceWorkerUrls,
  }
  delete urlsWithoutSelf[urlInfo.data.buildRelativeUrl]
  magicSource.prepend(generateClientCode(urlsWithoutSelf))
  const { content, sourcemap } = magicSource.toContentAndSourcemap()
  await kitchen.urlInfoTransformer.applyFinalTransformations(urlInfo, {
    content,
    sourcemap,
  })
}

const generateClientCode = (serviceWorkerUrls) => {
  return `
self.serviceWorkerUrls = ${JSON.stringify(serviceWorkerUrls, null, "  ")};
`
}

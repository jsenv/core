export const loadUrlGraph = async ({ context, startLoading, operation }) => {
  const promises = []
  const promiseMap = new Map()
  const cook = (urlInfo, context) => {
    const promiseFromData = promiseMap.get(urlInfo)
    if (promiseFromData) return promiseFromData
    const promise = _cook(urlInfo, context)
    promises.push(promise)
    promiseMap.set(urlInfo, promise)
    return promise
  }
  const _cook = async (urlInfo, dishContext) => {
    await context.cook(urlInfo, {
      cookDuringCook: cook,
      ...dishContext,
    })
    const { references } = urlInfo
    references.forEach((reference) => {
      // we don't cook resource hints
      // because they might refer to resource that will be modified during build
      // It also means something else have to reference that url in order to cook it
      // so that the preload is deleted by "resync_resource_hints.js" otherwise
      if (reference.isResourceHint) {
        return
      }
      // we use reference.generatedUrl to mimic what a browser would do:
      // do a fetch to the specifier as found in the file
      const referencedUrlInfo = context.urlGraph.reuseOrCreateUrlInfo(
        reference.generatedUrl,
      )
      cook(referencedUrlInfo, { reference })
    })
  }
  startLoading(
    ({ trace, parentUrl = context.rootDirectoryUrl, type, specifier }) => {
      const [entryReference, entryUrlInfo] = context.prepareEntryPoint({
        trace,
        parentUrl,
        type,
        specifier,
      })
      cook(entryUrlInfo, { reference: entryReference })
      return [entryReference, entryUrlInfo]
    },
  )

  const waitAll = async () => {
    if (operation) {
      operation.throwIfAborted()
    }
    if (promises.length === 0) {
      return
    }
    const promisesToWait = promises.slice()
    promises.length = 0
    await Promise.all(promisesToWait)
    await waitAll()
  }
  await waitAll()
  promiseMap.clear()
}

import { ensureEmptyDirectory } from "@jsenv/filesystem"

export const loadUrlGraph = async ({
  operation,
  urlGraph,
  kitchen,
  startLoading,
  outDirectoryUrl,
  clientRuntimeCompat,
}) => {
  if (outDirectoryUrl) {
    await ensureEmptyDirectory(outDirectoryUrl)
  }
  const promises = []
  const promiseMap = new Map()
  const cook = ({ urlInfo, ...rest }) => {
    const promiseFromData = promiseMap.get(urlInfo)
    if (promiseFromData) return promiseFromData
    const promise = _cook({
      urlInfo,
      outDirectoryUrl,
      clientRuntimeCompat,
      ...rest,
    })
    promises.push(promise)
    promiseMap.set(urlInfo, promise)
    return promise
  }
  const _cook = async ({ urlInfo, ...rest }) => {
    await kitchen.cook({
      urlInfo,
      cookDuringCook: cook,
      ...rest,
    })
    const { references } = urlInfo
    references.forEach((reference) => {
      // we don't cook ressource hints
      // because they might refer to ressource that will be modified during build
      // It also means something else have to reference that url in order to cook it
      // so that the preload is deleted by "resync_ressource_hints.js" otherwise
      if (reference.isRessourceHint) {
        return
      }
      // we use reference.generatedUrl to mimic what a browser would do:
      // do a fetch to the specifier as found in the file
      const referencedUrlInfo = urlGraph.reuseOrCreateUrlInfo(
        reference.generatedUrl,
      )
      cook({
        reference,
        urlInfo: referencedUrlInfo,
      })
    })
  }
  startLoading(
    ({ trace, parentUrl = kitchen.rootDirectoryUrl, type, specifier }) => {
      const [entryReference, entryUrlInfo] = kitchen.prepareEntryPoint({
        trace,
        parentUrl,
        type,
        specifier,
      })
      entryUrlInfo.data.isEntryPoint = true
      cook({
        reference: entryReference,
        urlInfo: entryUrlInfo,
      })
      return [entryReference, entryUrlInfo]
    },
  )

  const waitAll = async () => {
    operation.throwIfAborted()
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

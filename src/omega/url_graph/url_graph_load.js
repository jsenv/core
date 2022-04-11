import { ensureEmptyDirectory } from "@jsenv/filesystem"

export const loadUrlGraph = async ({
  urlGraph,
  kitchen,
  startLoading,
  outDirectoryUrl,
  runtimeSupport,
}) => {
  if (outDirectoryUrl) {
    await ensureEmptyDirectory(outDirectoryUrl)
  }
  const promises = []
  const cook = ({ urlInfo, ...rest }) => {
    const promiseFromData = urlInfo.data.promise
    if (promiseFromData) return promiseFromData
    const promise = _cook({
      urlInfo,
      outDirectoryUrl,
      runtimeSupport,
      ...rest,
    })
    promises.push(promise)
    urlInfo.data.promise = promise
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
      cook({
        reference,
        urlInfo: urlGraph.getUrlInfo(reference.url),
      })
    })
  }
  startLoading(
    ({ trace, parentUrl = kitchen.rootDirectoryUrl, type, specifier }) => {
      const entryReference = kitchen.createReference({
        trace,
        parentUrl,
        type,
        specifier,
      })
      const entryUrlInfo = kitchen.resolveReference(entryReference)
      entryUrlInfo.data.isEntryPoint = true
      cook({
        reference: entryReference,
        urlInfo: entryUrlInfo,
      })
      return [entryReference, entryUrlInfo]
    },
  )

  const waitAll = async () => {
    if (promises.length === 0) {
      return
    }
    const promisesToWait = promises.slice()
    promises.length = 0
    await Promise.all(promisesToWait)
    await waitAll()
  }
  await waitAll()
}

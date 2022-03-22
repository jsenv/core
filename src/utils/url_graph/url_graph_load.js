export const loadUrlGraph = async ({
  urlGraph,
  kitchen,
  startLoading,
  outDirectoryUrl,
  runtimeSupport,
}) => {
  const cook = ({ urlInfo, ...rest }) => {
    const promiseFromData = urlInfo.data.promise
    if (promiseFromData) return promiseFromData
    const promise = _cook({
      urlInfo,
      outDirectoryUrl,
      runtimeSupport,
      ...rest,
    })
    urlInfo.data.promise = promise
    return promise
  }

  const _cook = async ({ urlInfo, ...rest }) => {
    await kitchen.cook({
      urlInfo,
      ...rest,
    })
    const { references } = urlInfo
    await Promise.all(
      references.map(async (reference) => {
        await cook({
          reference,
          urlInfo: urlGraph.getUrlInfo(reference.url),
        })
      }),
    )
  }

  const promises = []
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
      promises.push(
        cook({
          reference: entryReference,
          urlInfo: entryUrlInfo,
        }),
      )
    },
  )
  await Promise.all(promises)
}

// export const reloadUrlGraph = async ({
//   urlGraph,
//   kitchen,
//   outDirectoryUrl,
//   runtimeSupport,
//   startLoading,
// }) => {
//   Object.keys(urlGraph.urlInfos).forEach((url) => {
//     const urlInfo = urlGraph.urlInfos[url]
//     urlInfo.data.promise = null
//   })
// }

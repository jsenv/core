export const loadUrlGraph = async ({
  urlGraph,
  kitchen,
  outDirectoryUrl,
  runtimeSupport,
  startLoading,
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
  startLoading((params) => {
    promises.push(cook(params))
  })
  await Promise.all(promises)
}

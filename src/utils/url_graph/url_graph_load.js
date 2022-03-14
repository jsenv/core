export const loadUrlGraph = async ({
  urlGraph,
  kitchen,
  outDirectoryName,
  runtimeSupport,
  startLoading,
}) => {
  const urlPromiseCache = {}

  const cookUrl = ({ url, ...rest }) => {
    const promiseFromCache = urlPromiseCache[url]
    if (promiseFromCache) return promiseFromCache
    const promise = _cookUrl({
      outDirectoryName,
      runtimeSupport,
      url,
      ...rest,
    })
    urlPromiseCache[url] = promise
    return promise
  }

  const _cookUrl = async (params) => {
    const cookedUrl = await kitchen.cookUrl(params)
    if (cookedUrl.error) {
      throw cookedUrl.error
    }
    const urlInfo = urlGraph.getUrlInfo(cookedUrl.url)
    const { url, dependencies, dependencyUrlSites } = urlInfo
    const dependencyUrls = Array.from(dependencies.values())
    await Promise.all(
      dependencyUrls.map(async (dependencyUrl) => {
        await cookUrl({
          parentUrl: url,
          urlTrace: {
            type: "url_site",
            value: dependencyUrlSites[dependencyUrl],
          },
          url: dependencyUrl,
        })
      }),
    )
    return cookedUrl
  }

  const promises = []
  startLoading((params) => {
    promises.push(cookUrl(params))
  })
  await Promise.all(promises)
}

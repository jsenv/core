export const loadUrlGraph = async ({
  urlGraph,
  entryUrls,
  rootDirectoryUrl,
  kitchen,
  onCooked,
}) => {
  const urlPromiseCache = {}

  const cookUrl = ({ url, ...rest }) => {
    const promiseFromCache = urlPromiseCache[url]
    if (promiseFromCache) return promiseFromCache
    const promise = _cookUrl({
      outDirectoryName: `build`,
      url,
      ...rest,
    })
    urlPromiseCache[url] = promise
    return promise
  }

  const _cookUrl = async (params) => {
    const cookedUrl = await kitchen.cookUrl(params)
    onCooked(cookedUrl)
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

  await entryUrls.reduce(async (previous, entryUrl) => {
    await previous
    await cookUrl({
      parentUrl: rootDirectoryUrl,
      urlTrace: {
        type: "parameter",
        value: `"entryPoints" parameter to buildProject`,
      },
      url: entryUrl,
    })
  }, Promise.resolve())
}

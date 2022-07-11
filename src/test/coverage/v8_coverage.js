export const filterV8Coverage = async (
  v8Coverage,
  { rootDirectoryUrl, coverageConfig },
) => {
  const { URL_META } = await import("@jsenv/url-meta")
  const associations = URL_META.resolveAssociations(
    { cover: coverageConfig },
    rootDirectoryUrl,
  )
  const urlShouldBeCovered = (url) => {
    const { cover } = URL_META.applyAssociations({
      url: new URL(url, rootDirectoryUrl).href,
      associations,
    })
    return cover
  }

  const v8CoverageFiltered = {
    ...v8Coverage,
    result: v8Coverage.result.filter((fileReport) =>
      urlShouldBeCovered(fileReport.url),
    ),
  }
  return v8CoverageFiltered
}

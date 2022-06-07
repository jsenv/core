export const fetchOriginalUrlInfo = async ({
  urlInfo,
  context,
  searchParam,
  expectedType,
}) => {
  const urlObject = new URL(urlInfo.url)
  const { searchParams } = urlObject
  if (!searchParams.has(searchParam)) {
    return null
  }
  searchParams.delete(searchParam)
  const originalUrl = urlObject.href
  const originalReference = {
    ...(context.reference.original || context.reference),
    expectedType,
  }
  originalReference.url = originalUrl
  const originalUrlInfo = context.urlGraph.reuseOrCreateUrlInfo(
    originalReference.url,
  )
  await context.fetchUrlContent(originalUrlInfo, {
    reference: originalReference,
  })
  if (originalUrlInfo.dependents.size === 0) {
    context.urlGraph.deleteUrlInfo(originalUrlInfo.url)
  }
  return originalUrlInfo
}

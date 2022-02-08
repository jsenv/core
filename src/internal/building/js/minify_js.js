export const minifyJs = async ({
  url,
  map,
  sourcemapIncludeSources = true,
  content,
  ...rest
}) => {
  // https://github.com/terser-js/terser#minify-options
  const { minify } = await import("terser")
  const terserResult = await minify(
    {
      [url]: content,
    },
    {
      sourceMap: {
        ...(map ? { content: JSON.stringify(map) } : {}),
        asObject: true,
        includeSources: sourcemapIncludeSources,
      },
      ...rest,
    },
  )
  content = terserResult.code
  map = terserResult.map
  if (!map.sourcesContent) {
    map.sourcesContent = [content]
  }
  return { map, content }
}

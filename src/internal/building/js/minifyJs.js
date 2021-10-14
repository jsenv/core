export const minifyJs = async ({
  url,
  code,
  map,
  sourcemapIncludeSources = true,
  ...rest
}) => {
  // https://github.com/terser-js/terser#minify-options
  const { minify } = await import("terser")

  const terserResult = await minify(
    {
      [url]: code,
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

  code = terserResult.code
  map = terserResult.map

  if (!map.sourcesContent) {
    map.sourcesContent = [code]
  }

  return { code, map }
}

// https://github.com/terser-js/terser#minify-options

export const minifyJs = async (urlInfo, options) => {
  const url = urlInfo.url
  const content = urlInfo.content
  const sourcemap = urlInfo.sourcemap
  const isJsModule = urlInfo.type === "js_module"

  const { minify } = await import("terser")
  const terserResult = await minify(
    {
      [url]: content,
    },
    {
      sourceMap: {
        ...(sourcemap ? { content: JSON.stringify(sourcemap) } : {}),
        asObject: true,
        includeSources: true,
      },
      module: isJsModule,
      // We need to preserve "new InlineContent()" calls to be able to recognize them
      // after minification in order to version urls inside inline content text
      keep_fnames: /InlineContent/,
      ...options,
    },
  )
  return {
    content: terserResult.code,
    sourcemap: terserResult.map,
  }
}

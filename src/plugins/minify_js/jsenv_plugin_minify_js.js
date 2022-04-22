// https://github.com/terser-js/terser#minify-options

export const jsenvPluginMinifyJs = () => {
  const applyTerser = async (urlInfo) => {
    return minifyJs({
      url: urlInfo.url,
      content: urlInfo.content,
      sourcemap: urlInfo.sourcemap,
      isJsModule: urlInfo.type === "js_module",
    })
  }

  return {
    name: "jsenv:minify_js",
    appliesDuring: {
      build: true,
    },
    optimize: {
      js_classic: applyTerser,
      js_module: applyTerser,
    },
  }
}

const minifyJs = async ({ url, content, sourcemap, isJsModule }) => {
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
    },
  )
  return {
    content: terserResult.code,
    sourcemap: terserResult.map,
  }
}

// https://github.com/terser-js/terser#minify-options

export const minifyJs = async (jsUrlInfo, options) => {
  const url = jsUrlInfo.url;
  const content = jsUrlInfo.content;
  const sourcemap = jsUrlInfo.sourcemap;
  const isJsModule = jsUrlInfo.type === "js_module";

  const { minify } = await import("terser");
  const terserResult = await minify(
    {
      [url]: content,
    },
    {
      // a map costs terser ~20% of its time, only when the kitchen keeps it
      sourceMap: jsUrlInfo.context.sourcemapsEnabled
        ? {
            ...(sourcemap ? { content: JSON.stringify(sourcemap) } : {}),
            asObject: true,
            includeSources: true,
          }
        : false,
      module: isJsModule,
      // We need to preserve "new __InlineContent__()" calls to be able to recognize them
      // after minification in order to version urls inside inline content text
      keep_fnames: /__InlineContent__/,
      ...options,
    },
  );
  return {
    content: terserResult.code,
    sourcemap: terserResult.map,
  };
};

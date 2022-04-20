// https://github.com/terser-js/terser#minify-options

export const jsenvPluginMinifyJson = () => {
  return {
    name: "jsenv:minify_json",
    appliesDuring: {
      build: true,
    },
    optimize: {
      json: (urlInfo) => {
        const { content } = urlInfo
        if (
          content.includes(" ") ||
          content.includes("\n") ||
          content.includes("\t")
        ) {
          const jsonWithoutWhitespaces = JSON.stringify(JSON.parse(content))
          return jsonWithoutWhitespaces
        }
        return null
      },
    },
  }
}

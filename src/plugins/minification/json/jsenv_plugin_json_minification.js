// https://github.com/terser-js/terser#minify-options

export const jsenvPluginJsonMinification = () => {
  const minifyJson = (urlInfo) => {
    const { content } = urlInfo
    if (content.startsWith("{\n")) {
      const jsonWithoutWhitespaces = JSON.stringify(JSON.parse(content))
      return jsonWithoutWhitespaces
    }
    return null
  }

  return {
    name: "jsenv:json_minification",
    appliesDuring: {
      build: true,
    },
    optimize: {
      importmap: minifyJson,
      json: minifyJson,
      webmanifest: minifyJson,
    },
  }
}

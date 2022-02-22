import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"

export const jsenvBabelPlugin = () => {
  return {
    name: "jsenv_babel",

    transform: ({ url, contentType, content, ast }) => {
      if (contentType !== "application/javascript") {
        return null
      }
      return babelTransform({
        options,
        url,
        ast,
        content,
      })
    },
  }
}

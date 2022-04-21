import { transformWithParcel } from "@jsenv/utils/css_ast/parcel_css.js"

export const jsenvPluginMinifyCss = () => {
  return {
    name: "jsenv:minify_css",
    appliesDuring: {
      build: true,
    },
    optimize: {
      css: (urlInfo, context) => {
        const { code, map } = transformWithParcel(urlInfo, context)
        return {
          content: code,
          sourcemap: map,
        }
      },
    },
  }
}

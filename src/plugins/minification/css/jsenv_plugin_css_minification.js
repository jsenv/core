import { transformWithParcel } from "@jsenv/utils/css_ast/parcel_css.js"

export const jsenvPluginCssMinification = () => {
  return {
    name: "jsenv:css_minification",
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

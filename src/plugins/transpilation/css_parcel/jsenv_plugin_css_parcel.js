import { transformWithParcel } from "@jsenv/utils/css_ast/parcel_css.js"

// https://github.com/parcel-bundler/parcel-css
export const jsenvPluginCssParcel = () => {
  return {
    name: "jsenv:css_parcel",
    appliesDuring: "*",
    transform: {
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

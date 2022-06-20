import { transpileWithParcel } from "@jsenv/ast"

// https://github.com/parcel-bundler/parcel-css
export const jsenvPluginCssParcel = () => {
  return {
    name: "jsenv:css_parcel",
    appliesDuring: "*",
    transformUrlContent: {
      css: (urlInfo, context) => {
        const { code, map } = transpileWithParcel(urlInfo, context)
        return {
          content: String(code),
          sourcemap: map,
        }
      },
    },
  }
}

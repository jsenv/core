import { bundleWithParcel } from "@jsenv/utils/css_ast/parcel_css.js"

export const jsenvPluginCssBundling = () => {
  return {
    name: "jsenv:css_bundling",
    appliesDuring: {
      build: true,
    },
    bundle: {
      css: (urlInfos, context) => {
        const bundledCssUrlInfos = {}
        urlInfos.forEach((urlInfo) => {
          const { code, map } = bundleWithParcel(urlInfo, context)
          bundledCssUrlInfos[urlInfo.url] = {
            data: {
              generatedBy: "parcel",
            },
            contentType: "text/css",
            content: code,
            sourcemap: map,
          }
        })
        return bundledCssUrlInfos
      },
    },
  }
}

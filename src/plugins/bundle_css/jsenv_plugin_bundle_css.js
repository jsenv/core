import { bundleWithParcel } from "@jsenv/utils/css_ast/parcel_css.js"

export const jsenvPluginBundleCss = () => {
  return {
    name: "jsenv:bundle_css",
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
              generatedBy: "postcss",
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

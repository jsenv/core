import { bundleWithParcel } from "@jsenv/utils/css_ast/parcel_css.js"

export const bundleCss = ({ cssUrlInfos, context }) => {
  const bundledCssUrlInfos = {}
  cssUrlInfos.forEach((cssUrlInfo) => {
    const { code, map } = bundleWithParcel(cssUrlInfo, context)
    bundledCssUrlInfos[cssUrlInfo.url] = {
      data: {
        generatedBy: "parcel",
      },
      contentType: "text/css",
      content: code,
      sourcemap: map,
    }
  })
  return bundledCssUrlInfos
}

import { bundleWithParcel } from "@jsenv/utils/css_ast/parcel_css.js"

export const bundleCss = async ({ cssUrlInfos, context }) => {
  const bundledCssUrlInfos = {}
  cssUrlInfos.forEach((cssUrlInfo) => {
    const { code, map } = bundleWithParcel(cssUrlInfo, context)
    const content = String(code)
    const sourcemap = map
    // here we need to replace css urls to ensure
    // all urls targets the correct stuff
    bundledCssUrlInfos[cssUrlInfo.url] = {
      data: {
        generatedBy: "parcel",
      },
      contentType: "text/css",
      content,
      sourcemap,
    }
  })
  return bundledCssUrlInfos
}

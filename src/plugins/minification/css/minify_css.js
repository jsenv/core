import { minifyWithParcel } from "@jsenv/utils/src/css_ast/parcel_css.js"

export const minifyCss = ({ cssUrlInfo, context }) => {
  const { code, map } = minifyWithParcel(cssUrlInfo, context)
  return {
    content: String(code),
    sourcemap: map,
  }
}

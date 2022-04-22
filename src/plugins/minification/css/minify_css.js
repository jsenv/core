import { transformWithParcel } from "@jsenv/utils/css_ast/parcel_css.js"

export const minifyCss = ({ cssUrlInfo, context }) => {
  const { code, map } = transformWithParcel(cssUrlInfo, context)
  return {
    content: code,
    sourcemap: map,
  }
}

import { minifyWithParcel } from "@jsenv/ast"

export const minifyCss = ({ cssUrlInfo, context }) => {
  const { code, map } = minifyWithParcel(cssUrlInfo, context)
  return {
    content: String(code),
    sourcemap: map,
  }
}

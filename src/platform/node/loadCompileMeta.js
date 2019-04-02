import { memoizeOnce, fileRead } from "@dmail/helper"
import { hrefToPathname } from "@jsenv/module-resolution"
import { detect } from "./nodeDetect/index.js"
import { nodeToCompileId } from "./nodeToCompileId.js"

export const loadCompileMeta = memoizeOnce(async ({ compileInto, sourceOrigin }) => {
  const groupMapHref = `${sourceOrigin}/${compileInto}/groupMap.json`
  const groupMapPathname = hrefToPathname(groupMapHref)
  const groupMapFileContent = await fileRead(groupMapPathname)
  const groupMap = JSON.parse(groupMapFileContent)
  const node = detect()
  const compileId = nodeToCompileId(node, groupMap) || "otherwise"

  return { groupMap, compileId }
})

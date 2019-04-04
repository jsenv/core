import { memoizeOnce, fileRead } from "/node_modules/@dmail/helper/index.js"
import { hrefToPathname } from "/node_modules/@jsenv/module-resolution/index.js"
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

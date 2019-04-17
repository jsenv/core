import { memoizeOnce, fileRead } from "/node_modules/@dmail/helper/index.js"
import { hrefToPathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { detectNode } from "../node-group-resolver/detectNode.js"
import { nodeToCompileId } from "../node-group-resolver/nodeToCompileId.js"

export const loadCompileMeta = memoizeOnce(
  async ({ compileInto, compileIdOption = "auto", sourceOrigin }) => {
    const groupMapHref = `${sourceOrigin}/${compileInto}/groupMap.json`
    const groupMapPathname = hrefToPathname(groupMapHref)
    const groupMapFileContent = await fileRead(groupMapPathname)
    const groupMap = JSON.parse(groupMapFileContent)

    let compileId
    if (compileIdOption === "auto") {
      const node = detectNode()
      compileId = nodeToCompileId(node, groupMap) || "otherwise"
    } else {
      // here we could/should check if it's part of groupMap
      // the best version should be that htis function is configurable
      // and you can pass anything you want to decide what to load
      // that function would receive the groupMap
      // but we have to find how that function would be stringified
      // to be passed to the client or whatever
      compileId = compileIdOption
    }

    return { groupMap, compileId }
  },
)

import { memoizeOnce } from "@dmail/helper"
import { fileHrefToPathname } from "@jsenv/module-resolution"
import { getCompileMapHref } from "./localURL.js"
import { detect } from "./nodeDetect/index.js"
import { nodeToCompileId } from "./nodeToCompileId.js"

export const loadCompileMeta = memoizeOnce(({ sourceRootHref, compiledRootHref }) => {
  const compileMapHref = getCompileMapHref({ sourceRootHref, compiledRootHref })
  const compileMapPathname = fileHrefToPathname(compileMapHref)

  // eslint-disable-next-line import/no-dynamic-require
  const compileMap = require(compileMapPathname)
  const node = detect()
  const compileId = nodeToCompileId(node, compileMap) || "otherwise"

  return { compileMap, compileId }
})

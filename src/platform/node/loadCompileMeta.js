import { memoizeOnce } from "@dmail/helper"
import { fileHrefToFilename } from "@jsenv/module-resolution"
import { getCompileMapHref } from "./getCompileMapHref.js"
import { detect } from "./nodeDetect/index.js"
import { nodeToCompileId } from "./nodeToCompileId.js"

export const loadCompileMeta = memoizeOnce(({ compileInto, compileServerOrigin }) => {
  const compileMapHref = getCompileMapHref({ compileInto, compileServerOrigin })
  const compileMapPathname = fileHrefToFilename(compileMapHref)

  // eslint-disable-next-line import/no-dynamic-require
  const compileMap = require(compileMapPathname)
  const node = detect()
  const compileId = nodeToCompileId(node, compileMap) || "otherwise"

  return { compileMap, compileId }
})

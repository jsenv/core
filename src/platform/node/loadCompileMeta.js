import { memoizeOnce } from "@dmail/helper"
import { getCompileMapLocalURL } from "./localURL.js"
import { detect } from "./nodeDetect/index.js"
import { nodeToCompileId } from "./nodeToCompileId.js"

export const loadCompileMeta = memoizeOnce(({ localRoot, compileInto }) => {
  const compileMapLocalURL = getCompileMapLocalURL({ localRoot, compileInto })
  // eslint-disable-next-line import/no-dynamic-require
  const compileMap = require(compileMapLocalURL)
  const node = detect()
  const compileId = nodeToCompileId(node, compileMap) || "otherwise"
  return { compileMap, compileId }
})

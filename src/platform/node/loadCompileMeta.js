import { memoizeOnce } from "@dmail/helper"
import { getCompileMapLocalURL } from "./localURL.js"
import { nodeToCompileId } from "./nodeToCompileId.js"

export const loadCompileMeta = memoizeOnce(({ localRoot, compileInto }) => {
  const compileMapLocalURL = getCompileMapLocalURL({ localRoot, compileInto })
  // eslint-disable-next-line import/no-dynamic-require
  const compileMap = require(compileMapLocalURL)
  const compileId =
    nodeToCompileId({ name: "node", version: process.version.slice(1) }, compileMap) || "otherwise"
  return { compileMap, compileId }
})

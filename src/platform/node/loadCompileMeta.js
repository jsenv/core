import { memoizeOnce } from "@dmail/helper"
import { fileHrefToFilename } from "@jsenv/module-resolution"
import { getGroupDescriptionHref } from "../getGroupDescriptionHref.js"
import { detect } from "./nodeDetect/index.js"
import { nodeToCompileId } from "./nodeToCompileId.js"

export const loadCompileMeta = memoizeOnce(({ compileInto, compileServerOrigin }) => {
  const groupDescriptionHref = getGroupDescriptionHref({ compileInto, compileServerOrigin })
  const groupDescriptionPathname = fileHrefToFilename(groupDescriptionHref)

  // eslint-disable-next-line import/no-dynamic-require
  const groupDescription = require(groupDescriptionPathname)
  const node = detect()
  const compileId = nodeToCompileId(node, groupDescription) || "otherwise"

  return { groupDescription, compileId }
})

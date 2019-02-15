import { memoizeOnce } from "@dmail/helper"
import { fileHrefToPathname } from "@jsenv/module-resolution"
import { detect } from "./nodeDetect/index.js"
import { nodeToCompileId } from "./nodeToCompileId.js"

export const loadCompileMeta = memoizeOnce(({ compileInto, sourceOrigin }) => {
  const groupDescriptionHref = `${sourceOrigin}/${compileInto}/groupDescription.json`
  const groupDescriptionPathname = fileHrefToPathname(groupDescriptionHref)

  // eslint-disable-next-line import/no-dynamic-require
  const groupDescription = require(groupDescriptionPathname)
  const node = detect()
  const compileId = nodeToCompileId(node, groupDescription) || "otherwise"

  return { groupDescription, compileId }
})

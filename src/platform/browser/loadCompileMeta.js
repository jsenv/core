// compute-browser-compile-id will be a dynamic path
// eslint-disable-next-line import/no-unresolved
import { computeBrowserCompileId } from "COMPUTE_BROWSER_COMPILE_ID"
// \0platform-meta will be dynamically generated
// eslint-disable-next-line import/no-unresolved
import { groupMap } from "PLATFORM_META"
import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"

export const loadCompileMeta = memoizeOnce(async () => {
  const returnedCompileId = computeBrowserCompileId({ groupMap }) || "otherwise"

  if (typeof returnedCompileId === undefined) {
    return {
      groupMap,
      compileId: "otherwise",
    }
  }

  if (returnedCompileId in groupMap === false) {
    throw new Error(
      `computeBrowserCompileId must return one of ${Object.keys(
        groupMap,
      )}, got ${returnedCompileId}`,
    )
  }

  return {
    groupMap,
    compileId: returnedCompileId,
  }
})

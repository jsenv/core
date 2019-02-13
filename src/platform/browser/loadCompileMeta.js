import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { detect } from "./browserDetect/index.js"
import { browserToCompileId } from "./browserToCompileId.js"
import { fetchUsingXHR } from "./fetchUsingXHR.js"
import { getGroupDescriptionHref } from "../getGroupDescriptionHref.js"

export const loadCompileMeta = memoizeOnce(async ({ compileInto, compileServerOrigin }) => {
  const compileMapHref = getGroupDescriptionHref({ compileInto, compileServerOrigin })
  const groupDescriptionResponse = await fetchUsingXHR(compileMapHref)
  if (groupDescriptionResponse.status < 200 || groupDescriptionResponse.status >= 400) {
    return Promise.reject(groupDescriptionResponse)
  }

  const groupDescription = JSON.parse(groupDescriptionResponse.body)
  const browser = detect()
  const compileId = browserToCompileId(browser, groupDescription) || "otherwise"

  return {
    groupDescription,
    compileId,
  }
})

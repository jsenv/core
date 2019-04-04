import { memoizeOnce } from "/node_modules/@dmail/helper/src/memoizeOnce.js"
import { detect } from "./browserDetect/index.js"
import { browserToCompileId } from "./browserToCompileId.js"
import { fetchUsingXHR } from "./fetchUsingXHR.js"

export const loadCompileMeta = memoizeOnce(async ({ compileInto, compileServerOrigin }) => {
  const groupMapHref = `${compileServerOrigin}/${compileInto}/groupMap.json`

  const groupMapResponse = await fetchUsingXHR(groupMapHref)
  if (groupMapResponse.status < 200 || groupMapResponse.status >= 400) {
    return Promise.reject(groupMapResponse)
  }

  const groupMap = JSON.parse(groupMapResponse.body)
  const browser = detect()
  const compileId = browserToCompileId(browser, groupMap) || "otherwise"

  return {
    groupMap,
    compileId,
  }
})

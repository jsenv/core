import { memoizeOnce } from "/node_modules/@dmail/helper/src/memoizeOnce.js"
import { detect } from "./browserDetect/index.js"
import { browserToCompileId } from "./browserToCompileId.js"
import { fetchUsingXHR } from "./fetchUsingXHR.js"

export const loadCompileMeta = memoizeOnce(
  async ({ compileInto, compileIdOption = "auto", compileServerOrigin }) => {
    const groupMapHref = `${compileServerOrigin}/${compileInto}/groupMap.json`

    const groupMapResponse = await fetchUsingXHR(groupMapHref)
    if (groupMapResponse.status < 200 || groupMapResponse.status >= 400) {
      return Promise.reject(groupMapResponse)
    }
    const groupMap = JSON.parse(groupMapResponse.body)

    let compileId
    if (compileIdOption === "auto") {
      const browser = detect()
      compileId = browserToCompileId(browser, groupMap) || "otherwise"
    } else {
      // here we could/should check if it's part of groupMap
      // the best version should be that htis function is configurable
      // and you can pass anything you want to decide what to load
      // that function would receive the groupMap
      // but we have to find how that function would be stringified
      // to be passed to the client or whatever
      compileId = compileIdOption
    }

    return {
      groupMap,
      compileId,
    }
  },
)

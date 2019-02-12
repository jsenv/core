import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { detect } from "./browserDetect/index.js"
import { browserToCompileId } from "./browserToCompileId.js"
import { fetchUsingXHR } from "./fetchUsingXHR.js"
import { getCompileMapHref } from "./remoteURL.js"

export const loadCompileMeta = memoizeOnce(async ({ compileInto, compiledRootHref }) => {
  const compileMapHref = getCompileMapHref({ compileInto, compiledRootHref })
  const compileMapResponse = await fetchUsingXHR(compileMapHref)
  if (compileMapResponse.status < 200 || compileMapResponse.status >= 400) {
    return Promise.reject(compileMapResponse)
  }

  const compileMap = JSON.parse(compileMapResponse.body)
  const browser = detect()
  const compileId = browserToCompileId(browser, compileMap) || "otherwise"

  return {
    compileMap,
    compileId,
  }
})

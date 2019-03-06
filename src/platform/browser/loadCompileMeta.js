import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { detect } from "./browserDetect/index.js"
import { browserToCompileId } from "./browserToCompileId.js"
import { fetchUsingXHR } from "./fetchUsingXHR.js"

export const loadCompileMeta = memoizeOnce(async ({ compileInto, compileServerOrigin }) => {
  const groupDescriptionHref = `${compileServerOrigin}/${compileInto}/groupDescription.json`

  const groupDescriptionResponse = await fetchUsingXHR(groupDescriptionHref)
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

import { createBrowserRuntime } from "../runtime/createBrowserRuntime/createBrowserRuntime.js"
import { fetchUsingXHR } from "../fetchUsingXHR.js"
import { memoize } from "../memoize.js"

const getBrowserRuntime = memoize(async () => {
  const compileServerOrigin = document.location.origin
  const compileServerInfoResponse = await fetchUsingXHR(compileServerOrigin, {
    headers: {
      "x-jsenv-exploring": true,
    },
  })
  const { outDirectoryRelativeUrl } = await compileServerInfoResponse.json()
  const outDirectoryUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}`
  const afterOutDirectory = document.location.href.slice(outDirectoryUrl.length)
  const parts = afterOutDirectory.split("/")
  const compileId = parts[0]
  // const remaining = parts.slice(1).join("/")

  const browserRuntime = await createBrowserRuntime({
    compileServerOrigin,
    outDirectoryRelativeUrl,
    compileId,
  })
  return browserRuntime
})

window.__jsenv__ = {
  importFile: async (specifier) => {
    const browserRuntime = await getBrowserRuntime()
    return browserRuntime.importFile(specifier)
  },
}

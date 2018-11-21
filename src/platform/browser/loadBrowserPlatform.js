// propagating cancellation from server to client:
// server could execute a global function client side to request cancellation
// or client to connect to a server SSE asking for cancellation
// BUT this feature is not very important for now I guess
// client will just be killed if node controls it (chromium)
// otherwise we don't care

import { rejectionValueToMeta } from "./rejectionValueToMeta.js"
import { createLocaters } from "../createLocaters.js"
import { detect } from "./browserDetect/index.js"
import { browserToCompileId } from "./browserToCompileId.js"
import { fetchSource } from "./fetchSource.js"
import { evalSource } from "./evalSource.js"
import { open } from "./hotreload.js"

const onExecuteError = (error, { file, fileToRemoteSourceFile, hrefToFile }) => {
  const meta = rejectionValueToMeta(error, {
    fileToRemoteSourceFile,
    hrefToFile,
  })

  const html = `
<h1>
  <a href="${fileToRemoteSourceFile(file)}">${file}</a> import rejected
</h1>
<pre style="border: 1px solid black">${meta.data}</pre>
`

  document.body.innerHTML = html

  return Promise.reject(error)
}

export const loadBrowserPlatform = ({
  compileMap,
  platformFile,
  remoteRoot,
  compileInto,
  hotreload = false,
  hotreloadSSERoot,
  hotreloadCallback,
}) => {
  if (typeof compileMap !== "object") {
    throw new TypeError(`createBrowserPlatform compileMap must be an object, got ${compileMap}`)
  }

  const browser = detect()
  const compileId = browserToCompileId(browser, compileMap) || "otherwise"
  const {
    fileToRemoteCompiledFile,
    fileToRemoteInstrumentedFile,
    fileToRemoteSourceFile,
    hrefToFile,
    hrefToLocalFile,
  } = createLocaters({
    remoteRoot,
    compileInto,
    compileId,
  })
  const platformURL = `${compileId}/${platformFile}`

  return fetchSource(platformURL).then(({ status, reason, headers, body }) => {
    if (status < 200 || status >= 400) {
      return Promise.reject({ status, reason, headers, body })
    }

    evalSource(body, platformURL)
    const createPlatformHooks = window.__createPlatformHooks__
    const platformHooks = createPlatformHooks({
      fetchSource,
      evalSource,
      hrefToLocalFile,
      fileToRemoteCompiledFile,
    })

    if (hotreload) {
      const hotreloadPredicate = (file) => {
        if (platformHooks.isFileImported) {
          return platformHooks.isFileImported(file)
        }
        return true
      }

      open(hotreloadSSERoot, (file) => {
        if (hotreloadPredicate(file)) {
          hotreloadCallback({ file })
        }
      })
    }

    const executeFile = (file, { instrument = false } = {}) => {
      const remoteCompiledFile = instrument
        ? fileToRemoteCompiledFile(file)
        : fileToRemoteInstrumentedFile(file)

      return platformHooks.executeFile(remoteCompiledFile).catch((error) => {
        return onExecuteError(error, {
          file,
          fileToRemoteSourceFile,
          hrefToFile,
        })
      })
    }

    return { executeFile }
  })
}

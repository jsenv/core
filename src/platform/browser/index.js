// propagating cancellation from server to client:
// server could execute a global function client side to request cancellation
// or client to connect to a server SSE asking for cancellation
// BUT this feature is not very important for now I guess
// client will just be killed if node controls it (chromium)
// otherwise we don't care

import "../../platform-system/browser/index.js"
import { createLocaters } from "../createLocaters.js"
import { createImportTracker } from "../createImportTracker.js"
import { browserToCompileId } from "./browserToCompileId.js"
import { detect } from "./browserDetect/index.js"
import { open } from "./hotreload.js"
import { rejectionValueToMeta } from "./rejectionValueToMeta.js"

export const createBrowserPlatform = ({
  remoteRoot,
  compileInto,
  compileMap,
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
  } = createLocaters({
    remoteRoot,
    compileInto,
    compileId,
  })

  const { markFileAsImported, isFileImported } = createImportTracker()

  if (hotreload) {
    const hotreloadPredicate = (file) => {
      // isFileImported is useful in case the file was imported but is not
      // in System registry because it has a parse error or insantiate error
      if (isFileImported(file)) {
        return true
      }

      const remoteCompiledFile = fileToRemoteCompiledFile(file)
      return Boolean(window.System.get(remoteCompiledFile))
    }

    open(hotreloadSSERoot, (file) => {
      if (hotreloadPredicate(file)) {
        hotreloadCallback({ file })
      }
    })
  }

  const executeFile = ({ file, instrument = false, setup = () => {}, teardown = () => {} }) => {
    markFileAsImported(file)

    const remoteCompiledFile = instrument
      ? fileToRemoteCompiledFile(file)
      : fileToRemoteInstrumentedFile(file)

    return Promise.resolve()
      .then(setup)
      .then(() => window.System.import(remoteCompiledFile))
      .catch((error) => {
        const meta = rejectionValueToMeta(error, {
          fileToRemoteSourceFile,
          hrefToFile,
        })

        document.body.innerHTML = `<h1><a href="${fileToRemoteSourceFile(
          file,
        )}">${file}</a> import rejected</h1>
		<pre style="border: 1px solid black">${meta.data}</pre>`

        return Promise.reject(error)
      })
      .then(teardown)
  }

  return { executeFile }
}

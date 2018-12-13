import { teardownForOutput, teardownForOutputAndCoverageMap } from "../platformTeardown.js"
import { createLocaters } from "../createLocaters.js"
import { detect } from "./browserDetect/index.js"
import { rejectionValueToMeta } from "./rejectionValueToMeta.js"
import { browserToCompileId } from "./browserToCompileId.js"
import { fetchSource } from "./fetchSource.js"
import { evalSource } from "./evalSource.js"
import { open } from "./hotreload.js"

export const browserPlatform = {
  load,
}

const load = ({
  compileMap,
  // I'm not sure this is the server that should control
  // which platform file do we load
  // we will just fetch either native or system depending what we support
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

    const importer = window.__createImporter__({
      fetchSource,
      evalSource,
      hrefToLocalFile,
      fileToRemoteCompiledFile,
    })

    if (hotreload) {
      const hotreloadPredicate = (file) => {
        if (importer.fileIsImported) {
          return importer.fileIsImported(file)
        }
        return true
      }

      open(hotreloadSSERoot, (file) => {
        if (hotreloadPredicate(file)) {
          hotreloadCallback({ file })
        }
      })
    }

    const executeFile = (file, { instrument = false, collectCoverage = false } = {}) => {
      const remoteCompiledFile = instrument
        ? fileToRemoteCompiledFile(file)
        : fileToRemoteInstrumentedFile(file)

      return importer.importFile(remoteCompiledFile).then(
        (namespace) => {
          if (collectCoverage) {
            return teardownForOutputAndCoverageMap(namespace)
          }
          return teardownForOutput(namespace)
        },
        (error) => {
          return onExecuteError(error, {
            file,
            fileToRemoteSourceFile,
            hrefToFile,
          })
        },
      )
    }

    return { executeFile }
  })
}

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

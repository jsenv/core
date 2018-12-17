/* global compileMap */
import { teardownForOutput, teardownForOutputAndCoverageMap } from "../platformTeardown.js"
import { createLocaters } from "../createLocaters.js"
import { detect } from "./browserDetect/index.js"
import { rejectionValueToMeta } from "./rejectionValueToMeta.js"
import { browserToCompileId } from "./browserToCompileId.js"
import { fetchSource } from "./fetchSource.js"
import { evalSource } from "./evalSource.js"
import { open } from "./hotreload.js"

if (typeof compileMap !== "object") {
  throw new TypeError(`compileMap must be an object, got ${compileMap}`)
}

export const platform = {
  setup,
  importFile: () => {
    throw new Error(`platform importFile must be called after setup`)
  },
}

const setup = ({ remoteRoot, compileInto, hotreload = false, hotreloadSSERoot }) => {
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

  if (hotreload) {
    open(hotreloadSSERoot, (/*file*/) => {
      // we cannot just System.delete the file because
      // the change may have any impact, we have to reload
      // moreover we may be in an environement with native import
      // where we don't have access to module cache
      window.location.reload()
    })
  }

  platform.importFile = (file, { instrument = false, collectCoverage = false } = {}) => {
    return loadImporter().then((importer) => {
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
        },
      )
    })
  }

  let importerPromise
  const loadImporter = () => {
    if (importerPromise) return importerPromise

    const pluginNames = compileMap[compileId]
    if (pluginNames.indexOf("transform-modules-systemjs") > -1) {
      const importerHref = `${remoteRoot}/${compileInto}/${compileId}/browserSystemImporter.js`
      importerPromise = fetchSource(importerHref).then(({ status, reason, headers, body }) => {
        if (status < 200 || status >= 400) {
          return Promise.reject({ status, reason, headers, body })
        }

        evalSource(body, importerHref)
        const importer = window.__createImporter__({
          fetchSource,
          evalSource,
          hrefToLocalFile,
          fileToRemoteCompiledFile,
        })

        return importer
      })
    } else {
      importerPromise = Promise.resolve({
        import: (file) => {
          // we'll have to check how it behaves if server responds with 500
          // of if it throw on execution
          return import(file)
        },
      })
    }

    return importerPromise
  }
}

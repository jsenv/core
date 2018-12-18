import { memoizeOnce } from "../../functionHelper.js"
import { getCompileMapRemoteURL } from "../../compileProject/index.js"
import { teardownForOutput, teardownForOutputAndCoverageMap } from "../platformTeardown.js"
import { createLocaters } from "../createLocaters.js"
import { detect } from "./browserDetect/index.js"
import { rejectionValueToMeta } from "./rejectionValueToMeta.js"
import { browserToCompileId } from "./browserToCompileId.js"
import { fetchSource } from "./fetchSource.js"
import { evalSource } from "./evalSource.js"
import { open } from "./hotreload.js"

const getImporterHref = ({ remoteRoot }) => {
  return `${remoteRoot}/node_modules/dev-server/dist/browserSystemImporter.js`
}

const setup = ({ remoteRoot, compileInto, hotreload = false, hotreloadSSERoot }) => {
  if (hotreload) {
    open(hotreloadSSERoot, (/*file*/) => {
      // we cannot just System.delete the file because
      // the change may have any impact, we have to reload
      // moreover we may be in an environement with native import
      // where we don't have access to module cache
      window.location.reload()
    })
  }

  const loadInformer = memoizeOnce(async () => {
    const compileMapHref = getCompileMapRemoteURL({ remoteRoot, compileInto })
    const compileMapResponse = await fetchSource(compileMapHref)
    if (compileMapResponse.status < 200 || compileMapResponse.status >= 400) {
      return Promise.reject(compileMapResponse)
    }

    const compileMap = JSON.parse(compileMapResponse.body)
    const browser = detect()
    const compileId = browserToCompileId(browser, compileMap) || "otherwise"
    const locater = createLocaters({
      remoteRoot,
      compileInto,
      compileId,
    })

    return {
      compileMap,
      compileId,
      ...locater,
    }
  })

  const loadImporter = memoizeOnce(async () => {
    // importer depends on informer, but this is an implementation detail
    const { compileMap, compileId, hrefToLocalFile } = await loadInformer()

    const pluginNames = compileMap[compileId]
    if (pluginNames.indexOf("transform-modules-systemjs") > -1) {
      const importerHref = getImporterHref({ remoteRoot })
      const importerResponse = await fetchSource(importerHref)
      if (importerResponse.status < 200 || importerResponse.status >= 400) {
        return Promise.reject(importerResponse)
      }

      evalSource(importerResponse.body, importerHref)
      const systemImporter = window.__createSystemImporter__({
        fetchSource,
        evalSource,
        hrefToLocalFile,
      })

      return systemImporter
    }

    const nativeImporter = {
      importFile: (file) => {
        // we'll have to check how it behaves if server responds with 500
        // of if it throw on execution
        return import(file)
      },
    }

    return nativeImporter
  })

  platform.importFile = async (file, { instrument = false, collectCoverage = false } = {}) => {
    const [
      {
        fileToRemoteCompiledFile,
        fileToRemoteInstrumentedFile,
        fileToRemoteSourceFile,
        hrefToFile,
      },
      { importFile },
    ] = await Promise.all([loadInformer(), loadImporter()])

    const remoteCompiledFile = instrument
      ? fileToRemoteCompiledFile(file)
      : fileToRemoteInstrumentedFile(file)

    return importFile(remoteCompiledFile).then(
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
  }
}

export const platform = {
  setup,
  importFile: () => {
    throw new Error(`platform.importFile must be called after setup`)
  },
}

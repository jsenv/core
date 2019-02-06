import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { fetchUsingXHR } from "./fetchUsingXHR.js"
import { evalSource, evalSourceAt } from "./evalSource.js"
import { getBrowserSystemImporterRemoteURL } from "./remoteURL.js"
import { loadCompileMeta } from "./loadCompileMeta.js"

export const loadImporter = memoizeOnce(async ({ remoteRoot, compileInto }) => {
  // importer depends on informer, but this is an implementation detail
  const { compileMap, compileId } = await loadCompileMeta({ remoteRoot, compileInto })

  const { pluginNames } = compileMap[compileId]
  if (pluginNames.indexOf("transform-modules-systemjs") > -1) {
    const importerHref = getBrowserSystemImporterRemoteURL({ remoteRoot })
    const importerResponse = await fetchUsingXHR(importerHref)
    if (importerResponse.status < 200 || importerResponse.status >= 400) {
      return Promise.reject(importerResponse)
    }

    evalSourceAt(importerResponse.body, importerHref)

    const systemImporter = window.__browserImporter__.createSystemImporter({
      remoteRoot,
      compileInto,
      compileId,
      fetchSource,
      evalSource,
    })

    return systemImporter
  }

  const nativeImporter = {
    // we'll have to check how it behaves if server responds with 500
    // of if it throw on execution
    importFile: createNativeImportFile(),
  }

  return nativeImporter
})

// eval to avoid syntaxError because import allowed only inside module
// for browser without dynamic import
const createNativeImportFile = () => eval(`(function importFile(file){ return import(file) })`)

const fetchSource = ({ remoteFile, remoteParent }) => {
  return fetchUsingXHR(remoteFile, {
    "x-module-referer": remoteParent || remoteFile,
  })
}

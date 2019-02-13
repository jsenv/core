import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { fetchUsingXHR } from "./fetchUsingXHR.js"
import { evalSource } from "./evalSource.js"
import { getBrowserSystemImporterHref } from "./remoteURL.js"
import { loadCompileMeta } from "./loadCompileMeta.js"

export const loadImporter = memoizeOnce(async ({ compileInto, compileServerOrigin }) => {
  // importer depends on informer, but this is an implementation detail
  const { groupDescription, compileId } = await loadCompileMeta({
    compileInto,
    compileServerOrigin,
  })

  // one day maybe we'll be able to use nativeImporter but
  // for now transform-modules-systemjs is not inside groupDescription because
  // we have to use it no matter what
  // they day a native solution can bring top level await, custom
  // resolve, catch syntax error etc we may use nativeImporter
  const canUseNativeImporter =
    false &&
    groupDescription[compileId].babelPluginNameArray.indexOf("transform-modules-systemjs") === -1

  if (canUseNativeImporter) {
    const nativeImporter = {
      importFile: createNativeImportFile(),
    }

    return nativeImporter
  }

  const importerHref = getBrowserSystemImporterHref({ compileServerOrigin })
  const importerResponse = await fetchUsingXHR(importerHref)
  if (importerResponse.status < 200 || importerResponse.status >= 400) {
    return Promise.reject(importerResponse)
  }

  evalSource(importerResponse.body, importerHref)

  const systemImporter = window.__browserImporter__.createSystemImporter({
    compileInto,
    compileServerOrigin,
    compileId,
    fetchSource,
  })

  return systemImporter
})

// eval to avoid syntaxError because import allowed only inside module
// for browser without dynamic import
const createNativeImportFile = () => eval(`(function importFile(file){ return import(file) })`)

const fetchSource = ({ href, importer }) => {
  return fetchUsingXHR(href, {
    "x-module-referer": importer || href,
  })
}

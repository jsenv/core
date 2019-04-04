import { memoizeOnce } from "/node_modules/@dmail/helper/src/memoizeOnce.js"
import { fetchUsingXHR } from "./fetchUsingXHR.js"
import { evalSource } from "./evalSource.js"
import { loadCompileMeta } from "./loadCompileMeta.js"

export const loadImporter = memoizeOnce(async ({ compileInto, compileServerOrigin }) => {
  // importer depends on informer, but this is an implementation detail
  const { groupMap, compileId } = await loadCompileMeta({
    compileInto,
    compileServerOrigin,
  })

  // one day maybe we'll be able to use nativeImporter but
  // for now transform-modules-systemjs is not inside groupMap because
  // we have to use it no matter what
  // they day a native solution can bring top level await, custom
  // resolve, catch syntax error etc we may use nativeImporter
  const canUseNativeImporter =
    false && groupMap[compileId].incompatibleNameArray.indexOf("transform-modules-systemjs") === -1

  if (canUseNativeImporter) {
    const nativeImporter = {
      importFile: createNativeImportFile(),
    }

    return nativeImporter
  }

  const importerHref = `${compileServerOrigin}/node_modules/@jsenv/core/dist/browser-client/importer.js`
  // we could not really inline it as compileId is dynamc
  // we could generate it dynamically from a given importMap
  // because the compiledImportMap is just the rwa importMap
  // prefixed with /${compileInto}/${compileId}/
  const importMapHref = `${compileServerOrigin}/${compileInto}/importMap.${compileId}.json`
  const [importerResponse, importMapResponse] = await Promise.all([
    fetchHref(importerHref),
    fetchHref(importMapHref),
  ])

  evalSource(importerResponse.body, importerHref)
  const importMap = JSON.parse(importMapResponse.body)

  const browserImporter = await window.__browserImporter__
  const systemImporter = browserImporter.createSystemImporter({
    importMap,
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

const fetchHref = async (href) => {
  const response = await fetchUsingXHR(href)
  if (response.status < 200 || response.status >= 400) {
    return Promise.reject(response)
  }
  return response
}

const fetchSource = ({ href, importer }) => {
  return fetchUsingXHR(href, {
    "x-module-referer": importer || href,
  })
}

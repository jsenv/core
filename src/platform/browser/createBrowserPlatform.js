import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { ressourceToRemoteSourceFile } from "../locaters.js"
import { detect } from "./browserDetect/index.js"
import { rejectionValueToMeta } from "./rejectionValueToMeta.js"
import { browserToCompileId } from "./browserToCompileId.js"
import { fetchUsingXHR } from "./fetchUsingXHR.js"
import { evalSource, evalSourceAt } from "./evalSource.js"
import { getCompileMapRemoteURL, getBrowserSystemImporterRemoteURL } from "./remoteURL.js"

export const importCompiledFile = ({ remoteRoot, compileInto, file }) => {
  return genericImportCompiledFile({ loadCompileMeta, loadImporter, remoteRoot, compileInto, file })
}

export const executeCompiledFile = ({
  remoteRoot,
  compileInto,
  file,
  collectNamespace,
  collectCoverage,
  instrument = {},
}) =>
  genericExecuteCompiledFile({
    loadCompileMeta,
    loadImporter,
    readCoverage,
    onError,
    transformError,
    remoteRoot,
    compileInto,
    file,
    collectNamespace,
    collectCoverage,
    instrument,
  })

const loadCompileMeta = memoizeOnce(async ({ remoteRoot, compileInto }) => {
  const compileMapHref = getCompileMapRemoteURL({ remoteRoot, compileInto })
  const compileMapResponse = await fetchUsingXHR(compileMapHref)
  if (compileMapResponse.status < 200 || compileMapResponse.status >= 400) {
    return Promise.reject(compileMapResponse)
  }

  const compileMap = JSON.parse(compileMapResponse.body)
  const browser = detect()
  const compileId = browserToCompileId(browser, compileMap) || "otherwise"

  return {
    compileMap,
    compileId,
  }
})

const loadImporter = memoizeOnce(async ({ remoteRoot, compileInto }) => {
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

const readCoverage = () => window.__coverage__

const transformError = (error) => {
  if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
    return exceptionToObject(error.error)
  }
  return exceptionToObject(error)
}

const exceptionToObject = (exception) => {
  // we need to convert error to an object to make it stringifiable
  if (exception && exception instanceof Error) {
    const object = {}
    Object.getOwnPropertyNames(exception).forEach((name) => {
      object[name] = exception[name]
    })
    return object
  }

  return {
    message: exception,
  }
}

const onError = (error, { remoteRoot, compileInto, file }) => {
  const meta = rejectionValueToMeta(error, {
    remoteRoot,
    compileInto,
  })

  const css = `
  .jsenv-console pre[data-theme="dark"] {
    background: transparent;
    border: 1px solid black
  }

  .jsenv-console pre[data-theme="light"] {
    background: #1E1E1E;
    border: 1px solid white;
    color: #EEEEEE;
  }

  .jsenv-console pre[data-theme="light"] a {
    color: inherit;
  }
  `

  const html = `
    <style type="text/css">${css}></style>
    <div class="jsenv-console">
      <h1>
        <a href="${ressourceToRemoteSourceFile({
          ressource: file,
          remoteRoot,
        })}">${file}</a> import rejected
      </h1>
      <pre data-theme="${meta.dataTheme || "dark"}">${meta.data}</pre>
    </div>
    `
  appendHMTL(html, document.body)
  console.error(error)
}

const appendHMTL = (html, parentNode) => {
  const temoraryParent = document.createElement("div")
  temoraryParent.innerHTML = html
  transferChildren(temoraryParent, parentNode)
}

const transferChildren = (fromNode, toNode) => {
  while (fromNode.firstChild) {
    toNode.appendChild(fromNode.firstChild)
  }
}

const fetchSource = ({ remoteFile, remoteParent }) => {
  return fetchUsingXHR(remoteFile, {
    "x-module-referer": remoteParent || remoteFile,
  })
}

import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import {
  ressourceToRemoteInstrumentedFile,
  ressourceToRemoteCompiledFile,
  ressourceToRemoteSourceFile,
} from "../locaters.js"
import { detect } from "./browserDetect/index.js"
import { rejectionValueToMeta } from "./rejectionValueToMeta.js"
import { browserToCompileId } from "./browserToCompileId.js"
import { fetchUsingXHR } from "./fetchUsingXHR.js"
import { evalSource, evalSourceAt } from "./evalSource.js"
import { open } from "./hotreload.js"
import { getCompileMapRemoteURL, getBrowserSystemImporterRemoteURL } from "./remoteURL.js"

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

  const loadImporter = memoizeOnce(async () => {
    // importer depends on informer, but this is an implementation detail
    const { compileMap, compileId } = await loadInformer()

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

  platform.importFile = async (
    file,
    { collectNamespace = false, collectCoverage = false, instrument = collectCoverage } = {},
  ) => {
    const [{ compileId }, { importFile }] = await Promise.all([loadInformer(), loadImporter()])

    const remoteCompiledFile = instrument
      ? ressourceToRemoteInstrumentedFile({ ressource: file, remoteRoot, compileInto, compileId })
      : ressourceToRemoteCompiledFile({ ressource: file, remoteRoot, compileInto, compileId })

    try {
      const namespace = await importFile(remoteCompiledFile)
      if (collectCoverage) {
        await namespace.output
      }
      return {
        status: "resolved",
        namespace: collectNamespace ? namespace : undefined,
        coverageMap: collectCoverage ? window.__coverage__ : {},
      }
    } catch (error) {
      onError(error, { remoteRoot, compileInto, file })
      return {
        status: "rejected",
        error: transformError(error),
        coverageMap: collectCoverage ? window.__coverage__ : {},
      }
    }
  }
}

const transformError = (error) => {
  if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
    return error.error
  }
  return error
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

export const platform = {
  setup,
  importFile: () => {
    throw new Error(`platform.importFile must be called after setup`)
  },
}

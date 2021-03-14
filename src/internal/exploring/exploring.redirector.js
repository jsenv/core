import { fetchUrl } from "../fetch-browser.js"
import { fetchExploringJson } from "./fetchExploringJson.js"
import { computeCompileIdFromGroupId } from "../runtime/computeCompileIdFromGroupId.js"
import { resolveBrowserGroup } from "../runtime/resolveBrowserGroup.js"

const redirect = async () => {
  const { outDirectoryRelativeUrl, exploringHtmlFileRelativeUrl } = await fetchExploringJson()

  window.location.href = await decideExploringIndexUrl({
    outDirectoryRelativeUrl,
    exploringHtmlFileRelativeUrl,
  })
}

const decideExploringIndexUrl = async ({
  outDirectoryRelativeUrl,
  exploringHtmlFileRelativeUrl,
}) => {
  // for now it's not possible to avoid compilation
  // I need to list what is needed to support that
  // for instance it means we should collect coverage from chrome devtools
  // instead of instrumenting source code.
  // It also means we should be able somehow to collect namespace of module imported
  // by the html page
  const canAvoidCompilation = false

  if (canAvoidCompilation) {
    // start testing importmap support first and not in paralell
    // so that there is not module script loaded beore importmap is injected
    // it would log an error in chrome console and return undefined
    const importmap = await supportsImportmap()
    const supports = await Promise.all([
      importmap,
      supportsDynamicImport(),
      supportsTopLevelAwait(),
    ])
    if (supports.every(Boolean)) {
      return `/${exploringHtmlFileRelativeUrl}`
    }
  }
  const compileId = await decideCompileId({ outDirectoryRelativeUrl })
  return `/${outDirectoryRelativeUrl}${compileId}/${exploringHtmlFileRelativeUrl}`
}

const supportsDynamicImport = async () => {
  const moduleSource = "data:text/javascript;base64,ZXhwb3J0IGRlZmF1bHQgNDI="
  try {
    const namespace = await import(moduleSource)
    return namespace.default === 42
  } catch (e) {
    return false
  }
}

const supportsTopLevelAwait = () => {
  // don't know yet how to test this
  return true
}

const supportsImportmap = async () => {
  const specifier = jsToTextUrl(`export default false`)

  const importMap = {
    imports: {
      [specifier]: jsToTextUrl(`export default true`),
    },
  }

  const importmapScript = document.createElement("script")
  importmapScript.type = "importmap"
  importmapScript.textContent = JSON.stringify(importMap, null, "  ")
  insertAfter(importmapScript)

  const scriptModule = document.createElement("script")
  scriptModule.type = "module"
  scriptModule.src = jsToTextUrl(
    `import supported from "${specifier}"; window.__importmap_supported = supported`,
  )

  return new Promise((resolve, reject) => {
    scriptModule.onload = () => {
      const supported = window.__importmap_supported
      delete window.__importmap_supported
      resolve(supported)
    }
    scriptModule.onerror = () => {
      reject()
    }
    insertAfter(scriptModule)
  })
}

const jsToTextUrl = (js) => {
  return `data:text/javascript;base64,${window.btoa(js)}`
}

const insertAfter = (element) => {
  document.body.appendChild(element)
}

const decideCompileId = async ({ outDirectoryRelativeUrl }) => {
  const compileServerGroupMapUrl = `/${outDirectoryRelativeUrl}groupMap.json`
  const compileServerGroupMapResponse = await fetchUrl(compileServerGroupMapUrl)
  const compileServerGroupMap = await compileServerGroupMapResponse.json()

  const compileId = computeCompileIdFromGroupId({
    groupId: resolveBrowserGroup(compileServerGroupMap),
    groupMap: compileServerGroupMap,
  })
  return compileId
}

redirect()

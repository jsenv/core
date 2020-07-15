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
  const supports = await Promise.all([
    supportsDynamicImport(),
    supportsTopLevelAwait(),
    supportsImportmap(),
  ])
  if (supports.every(Boolean)) {
    return `/${exploringHtmlFileRelativeUrl}`
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
  scriptModule.src = jsToTextUrl(`import supported from "${specifier}"
window.__jsenv__importmap_supported = supported`)

  return new Promise((resolve) => {
    scriptModule.onload = () => {
      const supported = window.__jsenv__importmap_supported
      delete window.__jsenv__importmap_supported
      resolve(supported)
    }
    scriptModule.onerror = () => {
      resolve(false)
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

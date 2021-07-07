import { computeCompileIdFromGroupId } from "../runtime/computeCompileIdFromGroupId.js"
import { resolveBrowserGroup } from "../runtime/resolveBrowserGroup.js"
import { importJson } from "./importJson.js"
import { fetchExploringJson } from "./fetchExploringJson.js"

const redirect = async () => {
  const groupMapUrl = `/${outDirectoryRelativeUrl}groupMap.json`
  const envFileUrl = `/${outDirectoryRelativeUrl}env.json`
  const [groupMap, envJson, { outDirectoryRelativeUrl, exploringHtmlFileRelativeUrl }] =
    await Promise.all([importJson(groupMapUrl), importJson(envFileUrl), fetchExploringJson()])

  const compileId = await decideCompileId({ groupMap, outDirectoryRelativeUrl })
  const groupInfo = groupMap[compileId]
  const { inlineImportMapIntoHTML } = envJson

  const canUseNativeModuleSystem = await browserSupportsAllFeatures({
    groupInfo,
    inlineImportMapIntoHTML,
  })

  if (canUseNativeModuleSystem) {
    window.location.href = `/${exploringHtmlFileRelativeUrl}`
    return
  }

  window.location.href = `/${outDirectoryRelativeUrl}${compileId}/${exploringHtmlFileRelativeUrl}`
}

const decideCompileId = async ({ groupMap }) => {
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveBrowserGroup(groupMap),
    groupMap,
  })
  return compileId
}

const browserSupportsAllFeatures = async ({ groupInfo, inlineImportMapIntoHTML }) => {
  // for now it's not possible to avoid compilation
  // I need to list what is needed to support that
  // for instance it means we should collect coverage from chrome devtools
  // instead of instrumenting source code.
  // It also means we should be able somehow to collect namespace of module imported
  // by the html page
  const canAvoidCompilation = false
  if (!canAvoidCompilation) {
    return false
  }

  const requiredBabelPluginCount = countRequiredBabelPlugins(groupInfo)
  if (requiredBabelPluginCount > 0) {
    return false
  }

  if (groupInfo.jsenvPluginRequiredNameArray.length > 0) {
    return false
  }

  // start testing importmap support first and not in paralell
  // so that there is not module script loaded beore importmap is injected
  // it would log an error in chrome console and return undefined
  const hasImportmap = await supportsImportmap({
    //  chrome supports inline but not remote importmap
    // https://github.com/WICG/import-maps/issues/235

    // at this stage we won't know if the html file will use
    // an importmap or not and if that importmap is inline or specified with an src
    // so we should test if browser support local and remote importmap.
    // But there exploring server can inline importmap by transforming html
    // and in that case we can test only the local importmap support
    // so we test importmap support and the remote one
    remote: !inlineImportMapIntoHTML,
  })
  if (!hasImportmap) {
    return false
  }

  const hasDynamicImport = await supportsDynamicImport()
  if (!hasDynamicImport) {
    return false
  }

  const hasTopLevelAwait = await supportsTopLevelAwait()
  if (!hasTopLevelAwait) {
    return false
  }

  return true
}

const countRequiredBabelPlugins = (groupInfo) => {
  const { babelPluginRequiredNameArray } = groupInfo
  let count = babelPluginRequiredNameArray.length

  // When instrumentation CAN be handed by playwright
  // https://playwright.dev/docs/api/class-chromiumcoverage#chromiumcoveragestartjscoverageoptions
  // "transform-instrument" becomes non mandatory
  // TODO: set window.PLAYWRIGHT_COVERAGE to true in specific circustances
  const transformInstrumentIndex = babelPluginRequiredNameArray.indexOf("transform-instrument")
  if (transformInstrumentIndex > -1 && window.PLAYWRIGHT_COVERAGE) {
    count--
  }
  return count
}

const supportsImportmap = async ({ remote = true } = {}) => {
  const specifier = jsToTextUrl(`export default false`)

  const importMap = {
    imports: {
      [specifier]: jsToTextUrl(`export default true`),
    },
  }

  const importmapScript = document.createElement("script")
  const importmapString = JSON.stringify(importMap, null, "  ")
  importmapScript.type = "importmap"
  if (remote) {
    importmapScript.src = `data:application/json;base64,${window.btoa(importmapString)}`
  } else {
    importmapScript.textContent = importmapString
  }

  document.body.appendChild(importmapScript)

  const scriptModule = document.createElement("script")
  scriptModule.type = "module"
  scriptModule.src = jsToTextUrl(
    `import supported from "${specifier}"; window.__importmap_supported = supported`,
  )

  return new Promise((resolve, reject) => {
    scriptModule.onload = () => {
      const supported = window.__importmap_supported
      delete window.__importmap_supported
      document.body.removeChild(scriptModule)
      document.body.removeChild(importmapScript)
      resolve(supported)
    }
    scriptModule.onerror = () => {
      document.body.removeChild(scriptModule)
      document.body.removeChild(importmapScript)
      reject()
    }
    document.body.appendChild(scriptModule)
  })
}

const jsToTextUrl = (js) => {
  return `data:text/javascript;base64,${window.btoa(js)}`
}

const supportsDynamicImport = async () => {
  const moduleSource = jsToTextUrl(`export default 42`)
  try {
    const namespace = await import(moduleSource)
    return namespace.default === 42
  } catch (e) {
    return false
  }
}

const supportsTopLevelAwait = async () => {
  const moduleSource = jsToTextUrl(`export default await Promise.resolve(42)`)
  try {
    const namespace = await import(moduleSource)
    return namespace.default === 42
  } catch (e) {
    return false
  }
}

redirect()

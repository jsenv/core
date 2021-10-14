import { fetchJson } from "../../browser-utils/fetchJson.js"
import { computeCompileIdFromGroupId } from "../computeCompileIdFromGroupId.js"
import { detectBrowser } from "../detectBrowser/detectBrowser.js"
import { resolveGroup } from "../resolveGroup.js"

export const scanBrowserRuntimeFeatures = async ({
  coverageHandledFromOutside = false,
  failFastOnFeatureDetection = false,
} = {}) => {
  const { outDirectoryRelativeUrl } = await fetchJson(
    "/.jsenv/compile-meta.json",
  )
  const groupMapUrl = `/${outDirectoryRelativeUrl}groupMap.json`
  const envFileUrl = `/${outDirectoryRelativeUrl}env.json`
  const [groupMap, envJson] = await Promise.all([
    fetchJson(groupMapUrl),
    fetchJson(envFileUrl),
  ])

  const browser = detectBrowser()
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveGroup(browser, groupMap),
    groupMap,
  })
  const groupInfo = groupMap[compileId]
  const { inlineImportMapIntoHTML, customCompilerPatterns } = envJson

  const featuresReport = await getFeaturesReport({
    failFastOnFeatureDetection,
    inlineImportMapIntoHTML,
  })
  const pluginRequiredNameArray = pluginRequiredNamesFromGroupInfo(groupInfo, {
    coverageHandledFromOutside,
    featuresReport,
  })

  const canAvoidCompilation =
    customCompilerPatterns.length === 0 &&
    pluginRequiredNameArray.length === 0 &&
    featuresReport.importmapSupported &&
    featuresReport.dynamicImportSupported &&
    featuresReport.topLevelAwaitSupported

  return {
    canAvoidCompilation,
    featuresReport,
    customCompilerPatterns,
    pluginRequiredNameArray,
    inlineImportMapIntoHTML,
    outDirectoryRelativeUrl,
    compileId,
    browser,
  }
}

const getFeaturesReport = async ({
  failFastOnFeatureDetection,
  inlineImportMapIntoHTML,
}) => {
  const featuresReport = {
    importmapSupported: undefined,
    dynamicImportSupported: undefined,
    topLevelAwaitSupported: undefined,
  }

  // start testing importmap support first and not in paralell
  // so that there is not module script loaded beore importmap is injected
  // it would log an error in chrome console and return undefined
  const importmapSupported = await supportsImportmap({
    // chrome supports inline but not remote importmap
    // https://github.com/WICG/import-maps/issues/235

    // at this stage we won't know if the html file will use
    // an importmap or not and if that importmap is inline or specified with an src
    // so we should test if browser support local and remote importmap.
    // But there exploring server can inline importmap by transforming html
    // and in that case we can test only the local importmap support
    // so we test importmap support and the remote one
    remote: !inlineImportMapIntoHTML,
  })
  featuresReport.importmapSupported = importmapSupported
  if (!importmapSupported && failFastOnFeatureDetection) {
    return featuresReport
  }

  const dynamicImportSupported = await supportsDynamicImport()
  featuresReport.dynamicImportSupported = dynamicImportSupported
  if (!dynamicImportSupported && failFastOnFeatureDetection) {
    return featuresReport
  }

  const topLevelAwaitSupported = await supportsTopLevelAwait()
  featuresReport.topLevelAwaitSupported = topLevelAwaitSupported
  if (!topLevelAwaitSupported && failFastOnFeatureDetection) {
    return featuresReport
  }

  const jsonImportAssertionsSupported = await supportsJsonImportAssertions()
  featuresReport.jsonImportAssertionsSupported = jsonImportAssertionsSupported
  if (!jsonImportAssertionsSupported && failFastOnFeatureDetection) {
    return featuresReport
  }

  const cssImportAssertionsSupported = await supportsCssImportAssertions()
  featuresReport.cssImportAssertionsSupported = cssImportAssertionsSupported
  if (!cssImportAssertionsSupported && failFastOnFeatureDetection) {
    return featuresReport
  }

  return featuresReport
}

const pluginRequiredNamesFromGroupInfo = (
  groupInfo,
  { coverageHandledFromOutside, featuresReport },
) => {
  const { pluginRequiredNameArray } = groupInfo

  const importAssertionsSupported =
    featuresReport.jsonImportAssertionsSupported &&
    featuresReport.cssImportAssertionsSupported

  const pluginsToIgnore = [
    // When instrumentation CAN be handed by playwright
    // https://playwright.dev/docs/api/class-chromiumcoverage#chromiumcoveragestartjscoverageoptions
    // coverageHandledFromOutside is true and "transform-instrument" becomes non mandatory
    ...(coverageHandledFromOutside ? ["transform-instrument"] : []),
    ...(supportsNewStylesheet() ? ["new-stylesheet-as-jsenv-import"] : []),
    ...(importAssertionsSupported ? ["transform-import-assertions"] : []),
  ]

  const pluginRequiredNames = pluginRequiredNameArray.filter(
    (pluginName) => !pluginsToIgnore.includes(pluginName),
  )

  return pluginRequiredNames
}

const supportsNewStylesheet = () => {
  try {
    // eslint-disable-next-line no-new
    new CSSStyleSheet()
    return true
  } catch (e) {
    return false
  }
}

const supportsImportmap = async ({ remote = true } = {}) => {
  const specifier = asBase64Url(`export default false`)

  const importMap = {
    imports: {
      [specifier]: asBase64Url(`export default true`),
    },
  }

  const importmapScript = document.createElement("script")
  const importmapString = JSON.stringify(importMap, null, "  ")
  importmapScript.type = "importmap"
  if (remote) {
    importmapScript.src = `data:application/json;base64,${window.btoa(
      importmapString,
    )}`
  } else {
    importmapScript.textContent = importmapString
  }

  document.body.appendChild(importmapScript)

  const scriptModule = document.createElement("script")
  scriptModule.type = "module"
  scriptModule.src = asBase64Url(
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

const supportsDynamicImport = async () => {
  const moduleSource = asBase64Url(`export default 42`)
  try {
    const namespace = await import(moduleSource)
    return namespace.default === 42
  } catch (e) {
    return false
  }
}

const supportsTopLevelAwait = async () => {
  const moduleSource = asBase64Url(`export default await Promise.resolve(42)`)
  try {
    const namespace = await import(moduleSource)
    return namespace.default === 42
  } catch (e) {
    return false
  }
}

const supportsJsonImportAssertions = async () => {
  const jsonBase64Url = asBase64Url("42", "application/json")
  const moduleSource = asBase64Url(
    `export { default } from "${jsonBase64Url}" assert { type: "json" }`,
  )
  try {
    const namespace = await import(moduleSource)
    return namespace.default === 42
  } catch (e) {
    return false
  }
}

const supportsCssImportAssertions = async () => {
  const cssBase64Url = asBase64Url("p { color: red; }", "text/css")
  const moduleSource = asBase64Url(
    `export { default } from "${cssBase64Url}" assert { type: "css" }`,
  )
  try {
    const namespace = await import(moduleSource)
    return namespace.default instanceof CSSStyleSheet
  } catch (e) {
    return false
  }
}

const asBase64Url = (text, mimeType = "application/javascript") => {
  return `data:${mimeType};base64,${window.btoa(text)}`
}

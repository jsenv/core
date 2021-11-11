import { fetchJson } from "../../browser-utils/fetchJson.js"
import { computeCompileIdFromGroupId } from "../computeCompileIdFromGroupId.js"
import { detectBrowser } from "../detectBrowser/detectBrowser.js"
import { resolveGroup } from "../resolveGroup.js"

export const scanBrowserRuntimeFeatures = async ({
  coverageHandledFromOutside = false,
  failFastOnFeatureDetection = false,
} = {}) => {
  const { outDirectoryRelativeUrl,  inlineImportMapIntoHTML, customCompilerPatterns, groupMap } = await fetchJson(
    "/.jsenv/__compile_server_meta__.json",
  )

  const browser = detectBrowser()
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveGroup(browser, groupMap),
    groupMap,
  })
  const groupInfo = groupMap[compileId]

  const featuresReport = {
    importmap: undefined,
    dynamicImport: undefined,
    topLevelAwait: undefined,
    jsonImportAssertions: undefined,
    cssImportAssertions: undefined,
    newStylesheet: undefined,
  }
  await detectSupportedFeatures({
    featuresReport,
    failFastOnFeatureDetection,
    inlineImportMapIntoHTML,
  })
  const pluginRequiredNameArray = await pluginRequiredNamesFromGroupInfo(
    groupInfo,
    {
      featuresReport,
      coverageHandledFromOutside,
    },
  )

  const canAvoidCompilation =
    customCompilerPatterns.length === 0 &&
    pluginRequiredNameArray.length === 0 &&
    featuresReport.importmap &&
    featuresReport.dynamicImport &&
    featuresReport.topLevelAwait

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

const detectSupportedFeatures = async ({
  featuresReport,
  failFastOnFeatureDetection,
  inlineImportMapIntoHTML,
}) => {
  // start testing importmap support first and not in paralell
  // so that there is not module script loaded beore importmap is injected
  // it would log an error in chrome console and return undefined
  const importmap = await supportsImportmap({
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
  featuresReport.importmap = importmap
  if (!importmap && failFastOnFeatureDetection) {
    return
  }

  const dynamicImport = await supportsDynamicImport()
  featuresReport.dynamicImport = dynamicImport
  if (!dynamicImport && failFastOnFeatureDetection) {
    return
  }

  const topLevelAwait = await supportsTopLevelAwait()
  featuresReport.topLevelAwait = topLevelAwait
  if (!topLevelAwait && failFastOnFeatureDetection) {
    return
  }
}

const pluginRequiredNamesFromGroupInfo = async (
  groupInfo,
  { featuresReport, coverageHandledFromOutside },
) => {
  const { pluginRequiredNameArray } = groupInfo
  const requiredPluginNames = pluginRequiredNameArray.slice()
  const markPluginAsSupported = (name) => {
    const index = requiredPluginNames.indexOf(name)
    if (index > -1) {
      requiredPluginNames.splice(index, 1)
    }
  }

  // When instrumentation CAN be handed by playwright
  // https://playwright.dev/docs/api/class-chromiumcoverage#chromiumcoveragestartjscoverageoptions
  // coverageHandledFromOutside is true and "transform-instrument" becomes non mandatory
  if (coverageHandledFromOutside) {
    markPluginAsSupported("transform-instrument")
  }

  if (pluginRequiredNameArray.includes("transform-import-assertions")) {
    const jsonImportAssertions = await supportsJsonImportAssertions()
    featuresReport.jsonImportAssertions = jsonImportAssertions

    const cssImportAssertions = await supportsCssImportAssertions()
    featuresReport.cssImportAssertions = cssImportAssertions

    if (jsonImportAssertions && cssImportAssertions) {
      markPluginAsSupported("transform-import-assertions")
    }
  }

  if (pluginRequiredNameArray.includes("new-stylesheet-as-jsenv-import")) {
    const newStylesheet = supportsNewStylesheet()
    featuresReport.newStylesheet = newStylesheet
    markPluginAsSupported("new-stylesheet-as-jsenv-import")
  }

  return requiredPluginNames
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

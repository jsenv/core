/* eslint-env browser */

import { computeCompileIdFromGroupId } from "../runtime/computeCompileIdFromGroupId.js"
import { resolveGroup } from "../runtime/resolveGroup.js"
import { fetchJson } from "../browser_utils/fetchJson.js"
import { detectBrowser } from "../browser_detection/browser_detection.js"

export const scanBrowserRuntimeFeatures = async ({
  coverageHandledFromOutside = false,
  failFastOnFeatureDetection = false,
} = {}) => {
  const {
    outDirectoryRelativeUrl,
    inlineImportMapIntoHTML,
    customCompilerPatterns,
    compileServerGroupMap,
  } = await fetchJson("/.jsenv/__compile_server_meta__.json")

  const browser = detectBrowser()
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveGroup(browser, compileServerGroupMap),
    groupMap: compileServerGroupMap,
  })
  const groupInfo = compileServerGroupMap[compileId]

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
  const missingFeatureNames = await adjustMissingFeatureNames(groupInfo, {
    featuresReport,
    coverageHandledFromOutside,
  })

  const canAvoidCompilation =
    customCompilerPatterns.length === 0 &&
    missingFeatureNames.length === 0 &&
    featuresReport.importmap &&
    featuresReport.dynamicImport &&
    featuresReport.topLevelAwait

  return {
    canAvoidCompilation,
    featuresReport,
    customCompilerPatterns,
    missingFeatureNames,
    inlineImportMapIntoHTML,
    outDirectoryRelativeUrl,
    compileId,
    browser,
  }
}

const adjustMissingFeatureNames = async (
  groupInfo,
  { featuresReport, coverageHandledFromOutside },
) => {
  const { missingFeatureNames } = groupInfo
  const missingFeatureNamesCopy = missingFeatureNames.slice()
  const markAsSupported = (name) => {
    const index = missingFeatureNamesCopy.indexOf(name)
    if (index > -1) {
      missingFeatureNamesCopy.splice(index, 1)
    }
  }
  // When instrumentation CAN be handed by playwright
  // https://playwright.dev/docs/api/class-chromiumcoverage#chromiumcoveragestartjscoverageoptions
  // coverageHandledFromOutside is true and "transform-instrument" becomes non mandatory
  if (coverageHandledFromOutside) {
    markAsSupported("transform-instrument")
  }
  if (missingFeatureNames.includes("transform-import-assertions")) {
    const jsonImportAssertions = await supportsJsonImportAssertions()
    featuresReport.jsonImportAssertions = jsonImportAssertions

    const cssImportAssertions = await supportsCssImportAssertions()
    featuresReport.cssImportAssertions = cssImportAssertions

    if (jsonImportAssertions && cssImportAssertions) {
      markAsSupported("transform-import-assertions")
    }
  }
  if (missingFeatureNames.includes("new-stylesheet-as-jsenv-import")) {
    const newStylesheet = supportsNewStylesheet()
    featuresReport.newStylesheet = newStylesheet
    markAsSupported("new-stylesheet-as-jsenv-import")
  }
  return missingFeatureNamesCopy
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

  try {
    await executeWithScriptModuleInjection(
      `import supported from "${specifier}"; window.__jsenv_runtime_test_importmap__ = supported`,
    )
    document.body.removeChild(importmapScript)
    return window.__jsenv_runtime_test_importmap__
  } catch (e) {
    document.body.removeChild(importmapScript)
    return false
  }
}

const supportsDynamicImport = async () => {
  const moduleSource = asBase64Url(`export default 42`)
  try {
    await executeWithScriptModuleInjection(
      `window.__jsenv_runtime_test_dynamic_import__ = import(${JSON.stringify(
        moduleSource,
      )})`,
    )
    const namespace = await window.__jsenv_runtime_test_dynamic_import__
    return namespace.default === 42
  } catch (e) {
    return false
  }
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

const supportsTopLevelAwait = async () => {
  try {
    await executeWithScriptModuleInjection(
      `window.__jsenv_runtime_test_top_level_await__ = await Promise.resolve(42)`,
    )
    return window.__jsenv_runtime_test_top_level_await__ === 42
  } catch (e) {
    return false
  }
}

// to execute in a browser devtools
// const featuresReport = {}
// await detectSupportedFeatures({ featuresReport, inlineImportMapIntoHTML: true })
// console.log(featuresReport)

const supportsJsonImportAssertions = async () => {
  const jsonBase64Url = asBase64Url("42", "application/json")
  const moduleSource = asBase64Url(
    `import data from "${jsonBase64Url}" assert { type: "json" }
export default data`,
  )
  try {
    await executeWithScriptModuleInjection(
      `window.__jsenv_runtime_test_json_import_assertion__ = import(${JSON.stringify(
        moduleSource,
      )})`,
    )
    const namespace = await window.__jsenv_runtime_test_json_import_assertion__
    return namespace.default === 42
  } catch (e) {
    return false
  }
}

const supportsCssImportAssertions = async () => {
  const cssBase64Url = asBase64Url("p { color: red; }", "text/css")
  const moduleSource = asBase64Url(
    `import css from "${cssBase64Url}" assert { type: "css" }
export default css`,
  )
  try {
    await executeWithScriptModuleInjection(
      `window.__jsenv_runtime_test_css_import_assertion__ = import(${JSON.stringify(
        moduleSource,
      )})`,
    )
    const namespace = await window.__jsenv_runtime_test_css_import_assertion__
    return namespace.default instanceof CSSStyleSheet
  } catch (e) {
    return false
  }
}

const executeWithScriptModuleInjection = (code) => {
  const scriptModule = document.createElement("script")
  scriptModule.type = "module"

  const loadPromise = new Promise((resolve, reject) => {
    scriptModule.onload = () => {
      document.body.removeChild(scriptModule)
      resolve()
    }
    scriptModule.onerror = () => {
      document.body.removeChild(scriptModule)
      reject()
    }
    document.body.appendChild(scriptModule)
  })

  scriptModule.src = asBase64Url(code)

  return loadPromise
}

const asBase64Url = (text, mimeType = "application/javascript") => {
  return `data:${mimeType};base64,${window.btoa(text)}`
}

// const cssImportAssertions = await supportsCssImportAssertions()
// console.log({ cssImportAssertions })

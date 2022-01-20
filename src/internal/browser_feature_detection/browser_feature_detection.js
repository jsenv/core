import { fetchJson } from "../browser_utils/fetchJson.js"
import { detectBrowser } from "../browser_detection/browser_detection.js"
import { supportsImportmap } from "./browser_feature_detect_importmap.js"
import { supportsDynamicImport } from "./browser_feature_detect_dynamic_import.js"
import { supportsTopLevelAwait } from "./browser_feature_detect_top_level_await.js"
import { supportsJsonImportAssertions } from "./browser_feature_detect_import_assertions_json.js"
import { supportsCssImportAssertions } from "./browser_feature_detect_import_assertions_css.js"
import { supportsNewStylesheet } from "./browser_feature_detect_new_stylesheet.js"

export const scanBrowserRuntimeFeatures = async ({
  coverageHandledFromOutside = false,
  failFastOnFeatureDetection = false,
} = {}) => {
  const {
    outDirectoryRelativeUrl,
    inlineImportMapIntoHTML,
    featureNames,
    customCompilerPatterns,
  } = await fetchJson("/.jsenv/__compile_meta__.json")
  const browser = detectBrowser()
  const featuresReport = {}
  await detectSupportedFeatures({
    failFastOnFeatureDetection,
    coverageHandledFromOutside,
    inlineImportMapIntoHTML,
    featureNames,
    featuresReport,
  })
  const { compileId } = await fetchJson("/.jsenv/__compile_meta__.json", {
    method: "POST",
  })
  return {
    browser,
    outDirectoryRelativeUrl,
    inlineImportMapIntoHTML,
    featureNames,
    featuresReport,
    customCompilerPatterns,
    compileId,
  }
}

const detectSupportedFeatures = async ({
  failFastOnFeatureDetection,
  coverageHandledFromOutside,
  inlineImportMapIntoHTML,
  featureNames,
  featuresReport,
}) => {
  // js coverage
  // When instrumentation CAN be handed by playwright
  // https://playwright.dev/docs/api/class-chromiumcoverage#chromiumcoveragestartjscoverageoptions
  // coverageHandledFromOutside is true and "transform-instrument" becomes non mandatory
  if (featureNames.includes("transform-instrument")) {
    const jsCoverage = coverageHandledFromOutside
    featuresReport.newStylesheet = jsCoverage
    if (!jsCoverage && failFastOnFeatureDetection) {
      return
    }
  }
  // new CSSStyleSheet
  if (featureNames.includes("new-stylesheet-as-jsenv-import")) {
    const newStylesheet = supportsNewStylesheet()
    featuresReport.newStylesheet = newStylesheet
    if (!newStylesheet && failFastOnFeatureDetection) {
      return
    }
  }
  // importmap
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
  // dynamic import
  const dynamicImport = await supportsDynamicImport()
  featuresReport.dynamicImport = dynamicImport
  if (!dynamicImport && failFastOnFeatureDetection) {
    return
  }
  // top level await
  const topLevelAwait = await supportsTopLevelAwait()
  featuresReport.topLevelAwait = topLevelAwait
  if (!topLevelAwait && failFastOnFeatureDetection) {
    return
  }
  // import assertions
  if (featureNames.includes("transform-import-assertions")) {
    const jsonImportAssertions = await supportsJsonImportAssertions()
    featuresReport.jsonImportAssertions = jsonImportAssertions

    const cssImportAssertions = await supportsCssImportAssertions()
    featuresReport.cssImportAssertions = cssImportAssertions

    featuresReport.importAssertions =
      jsonImportAssertions && cssImportAssertions
    if (!featuresReport.importAssertions && failFastOnFeatureDetection) {
      return
    }
  }
}

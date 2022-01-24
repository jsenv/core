import { fetchJson } from "../../browser_utils/fetchJson.js"
import { detectBrowser } from "../../browser_detection/browser_detection.js"

import { supportsImportmap } from "./browser_feature_detect_importmap.js"
import { supportsDynamicImport } from "./browser_feature_detect_dynamic_import.js"
import { supportsTopLevelAwait } from "./browser_feature_detect_top_level_await.js"
import { supportsJsonImportAssertions } from "./browser_feature_detect_import_assertions_json.js"
import { supportsCssImportAssertions } from "./browser_feature_detect_import_assertions_css.js"
import { supportsNewStylesheet } from "./browser_feature_detect_new_stylesheet.js"

export const scanBrowserRuntimeFeatures = async ({
  coverageHandledFromOutside = false,
} = {}) => {
  const jsenvCompileProfileUrl = "/__jsenv_compile_profile__"
  const { jsenvDirectoryRelativeUrl, inlineImportMapIntoHTML } =
    await fetchJson(jsenvCompileProfileUrl)
  const { name, version } = detectBrowser()
  const featuresReport = await detectSupportedFeatures({
    coverageHandledFromOutside,
    inlineImportMapIntoHTML,
  })
  const runtimeReport = {
    env: { browser: true },
    name,
    version,
    featuresReport,
  }
  const { compileProfile, compileId } = await fetchJson(
    jsenvCompileProfileUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(runtimeReport),
    },
  )
  return {
    jsenvDirectoryRelativeUrl,
    inlineImportMapIntoHTML,
    compileProfile,
    compileId,
  }
}

const detectSupportedFeatures = async ({
  coverageHandledFromOutside,
  inlineImportMapIntoHTML,
}) => {
  const featuresReport = {}
  featuresReport.import_http = true
  featuresReport["transform-instrument"] = coverageHandledFromOutside
  // new CSSStyleSheet
  featuresReport.newStylesheet = supportsNewStylesheet()
  // importmap
  // start testing importmap support first and not in paralell
  // so that there is not module script loaded beore importmap is injected
  // it would log an error in chrome console and return undefined
  featuresReport.importmap = await supportsImportmap({
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
  // dynamic import
  featuresReport.dynamicImport = await supportsDynamicImport()
  // top level await
  featuresReport.topLevelAwait = await supportsTopLevelAwait()
  // import assertions
  featuresReport.jsonImportAssertions = await supportsJsonImportAssertions()
  featuresReport.cssImportAssertions = await supportsCssImportAssertions()
}

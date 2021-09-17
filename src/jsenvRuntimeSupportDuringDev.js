import {
  PLAYWRIGHT_CHROMIUM_VERSION,
  PLAYWRIGHT_FIREFOX_VERSION,
  PLAYWRIGHT_WEBKIT_VERSION,
} from "./playwright_browser_versions.js"

export const jsenvRuntimeSupportDuringDev = {
  chrome: PLAYWRIGHT_CHROMIUM_VERSION,
  firefox: PLAYWRIGHT_FIREFOX_VERSION,
  safari: PLAYWRIGHT_WEBKIT_VERSION,
  node: process.version.slice(1),
}

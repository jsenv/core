/*
 * This test exists to ensure chromiumRuntimeTab actually shares
 * the chromium browser and opens tab inside it.
 * By uncommenting stopAfterExecute: false, I can manually ensure that after executeTestPlan
 * two chromium are opened (not three)
 * and one of them has two tabs
 */

import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  executeTestPlan,
  chromiumTabRuntime,
  chromiumRuntime,
  firefoxRuntime,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.html`
const headless = false
const testPlan = {
  [fileRelativeUrl]: {
    tab1: {
      runtime: chromiumTabRuntime,
      runtimeParams: { headless },
    },
    chromium: {
      runtime: chromiumRuntime,
      runtimeParams: { headless },
    },
    tab2: {
      runtime: chromiumTabRuntime,
      runtimeParams: { headless },
    },
    firefox: {
      runtime: firefoxRuntime,
      runtimeParams: { headless },
    },
  },
  // [`${testDirectoryRelativeUrl}file.js`]: {
  //   node: {
  //     runtime: nodeRuntime,
  //   },
  // },
}
await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  stopAfterExecute: false,
})

import {
  executeTestPlan,
  chromiumRuntimeTab,
  firefoxRuntimeTab,
} from "@jsenv/core"

executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./animals.test.html": {
      chromium: {
        runtime: chromiumRuntimeTab,
      },
      firefox: {
        runtime: firefoxRuntimeTab,
      },
    },
  },
})

import {
  executeTestPlan,
  chromiumTabRuntime,
  firefoxTabRuntime,
} from "@jsenv/core"

await executeTestPlan({
  projectDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./animals.test.html": {
      chromium: {
        runtime: chromiumTabRuntime,
      },
      firefox: {
        runtime: firefoxTabRuntime,
      },
    },
  },
})

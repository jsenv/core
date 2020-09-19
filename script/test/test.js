import { executeTestPlan, launchNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/**/*.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: 60 * 1000,
      },
    },
    // give more time to the first test because it generates many file cached afterwards
    "test/execute/alive-after-execution/*.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: 120 * 1000,
      },
    },
    "test/execute/basic/file.chromium.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: 80 * 1000,
      },
    },
    "test/launchBrowser/**/*.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: process.platform === "win32" ? 120 * 1000 : 60 * 1000,
      },
    },
    "test/startExploring/**/*.test.js": {
      node: {
        launch: launchNode,
        // allocate more time (60s) for these tests, they can be long
        allocatedMs: 80 * 1000,
      },
    },
  },
  coverageConfig: {
    "./index.js": true,
    "./src/**/*.js": true,
    "./src/**/continuous-testing/": false,
    "./**/*.test.*": false,
    "./**/test/": false,
  },
})

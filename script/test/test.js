import { executeTestPlan, launchNode } from "@jsenv/core"

import * as jsenvConfig from "../../jsenv.config.mjs"

await executeTestPlan({
  ...jsenvConfig,
  testPlan: {
    "test/**/*.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: 60 * 1000,
      },
    },
    // give more time to the first test because it generates many file cached afterwards
    "test/__internal__/buildServiceWorker/basic/*.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: 180 * 1000,
      },
    },
    "test/__internal__/executeTestPlan/**/*.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: 180 * 1000,
      },
    },
    "test/**/execute-basic/*.browser.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: 80 * 1000,
      },
    },
    "test/**/*-launch-browser/**/*.test.js": {
      node: {
        launch: launchNode,
        allocatedMs: process.platform === "win32" ? 120 * 1000 : 60 * 1000,
      },
    },
    "test/**/*-exploring/**/*.test.js": {
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

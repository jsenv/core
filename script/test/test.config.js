const { launchNode } = require("@jsenv/core")

const testDescription = {
  "/test/**/*.test.js": {
    node: null,
  },
  // both browser and node test all passing
  // "/test/bundle-browser/**/*.test.*": {
  //   node: {
  //     launch: launchNode,
  //   },
  // },
  // "/test/bundle-node/**/*.test.*": {
  //   node: {
  //     launch: launchNode,
  //   },
  // },
  "/test/bundle-node/async-generator/": {
    node: null,
  },
  "/test/bundle-node/https/": {
    node: null,
  },
  // "/test/launch-chromium/**/*.test.js": {
  //   node: {
  //     launch: launchNode,
  //   },
  // },
  "/test/launch-node/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
}
exports.testDescription = testDescription

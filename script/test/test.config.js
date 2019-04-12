const { launchNode } = require("@jsenv/core")

const testDescription = {
  // "/test/**/*.test.js": {
  //   node: {
  //     launch: launchNode,
  //   },
  // },
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
  // "/test/bundle-node/async-generator/": {
  //   node: null,
  // },
  // "/test/bundle-node/https/": {
  //   node: null,
  // },
  // "/test/bundle-node/top-level-await/": {
  //   node: null,
  // },
  "/test/launch-chromium/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
  "/test/launch-node/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
  // "/test/generate-import-map/**/*.test.js": {
  //   node: {
  //     launch: launchNode,
  //   },
  // },
}
exports.testDescription = testDescription

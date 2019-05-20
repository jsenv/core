const { launchNode } = require("@jsenv/core")
const { jsenvBabelPluginMap } = require("./node_modules/@jsenv/babel-plugin-map/index.js")

const projectFolder = __dirname
exports.projectFolder = projectFolder

const testDescription = {
  "/test/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
  "/test/bundle-browser/**/*.test.*": {
    node: {
      launch: launchNode,
    },
  },
  "/test/bundle-node/**/*.test.*": {
    node: {
      launch: launchNode,
    },
  },
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
  "/test/generate-import-map/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
}
exports.testDescription = testDescription

const coverDescription = {
  "/index.js": true,
  "/src/**/*.js": true,
  "/**/*.test.*": false, // contains .test. -> nope
  "/**/test/": false, // inside a test folder -> nope
}
exports.coverDescription = coverDescription

exports.babelPluginMap = jsenvBabelPluginMap

/* globals require, __dirname  */
// eslint-disable-next-line import/no-unresolved
const { startExploring } = require("@jsenv/core")

startExploring({
  projectDirectoryUrl: __dirname,
  explorableConfig: {
    source: {
      "./src/*.js": true,
    },
  },
  port: 3456,
  livereloading: true,
})

// eslint-disable-next-line import/no-unresolved
const { startExploring } = require("@jsenv/core")

startExploring({
  projectDirectoryPath: __dirname,
  explorableConfig: {
    "./src/*.js": true,
  },
  port: 3456,
})

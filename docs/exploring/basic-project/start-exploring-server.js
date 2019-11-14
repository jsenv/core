// eslint-disable-next-line import/no-unresolved
const { startExploringServer } = require("@jsenv/exploring-server")

startExploringServer({
  projectPath: __dirname,
  explorableMap: {
    "/src/*.js": true,
  },
  port: 3456,
})

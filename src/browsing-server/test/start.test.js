import { startBrowsingServer } from "../startBrowsingServer.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")
const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

const testFolder = `${projectFolder}/src/browsing-server/test`

startBrowsingServer({
  projectFolder: testFolder,
  compileInto: ".dist",
  babelConfigMap,
  browsableDescription: {
    "/*.js": true,
    "/*.test.*": false,
  },
})

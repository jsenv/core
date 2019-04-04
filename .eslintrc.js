const { createConfig } = require("@jsenv/eslint-config")
const { importMap, projectFolder } = require("./jsenv.config.js")

const config = createConfig()
config.rules["import/no-absolute-path"] = ["off"]
config.settings["import/resolver"] = {
  [`${projectFolder}/node_modules/@jsenv/eslint-import-resolver/dist/node/main.js`]: {
    importMap,
    projectFolder,
    verbose: false,
  },
}

module.exports = config

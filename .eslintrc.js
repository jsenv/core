const { createConfig } = require("@jsenv/eslint-config")
const { readImportMap, projectFolder } = require("./jsenv.config.js")

const config = createConfig()
config.rules["import/no-absolute-path"] = ["off"]
config.settings["import/resolver"] = {
  [`${projectFolder}/node_modules/@jsenv/eslint-import-resolver/dist/node/main.js`]: {
    importMap: readImportMap(),
    projectFolder,
    verbose: false,
  },
}

module.exports = config

const config = require("@dmail/project-eslint-config").config

config.settings["import/resolver"] = {
  "@jsenv/eslint-import-resolver/index.js": {
    localRoot: __dirname,
    resolveBareImportWithNodeModule: true,
    verbose: true,
  },
}
config.rules["import/no-absolute-path"] = ["off"]

module.exports = config

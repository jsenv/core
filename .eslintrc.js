const config = require("@dmail/project-eslint-config").config

config.settings["import/resolver"] = {
  ["./eslint-import-resolver-jsenv.js"]: {},
}
config.rules["import/no-absolute-path"] = ["off"]

module.exports = config

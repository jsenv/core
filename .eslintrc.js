const config = require("@dmail/project-eslint-config").config

config.settings["import/resolver"] = {
  ["./eslint-import-resolver-jsenv.js"]: {},
}

module.exports = config

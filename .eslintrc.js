const { createConfig } = require("@dmail/project-eslint-config")

const config = createConfig()

// config.settings["import/resolver"] = {
//   "@jsenv/eslint-import-resolver/dist/src/resolver.js": {
//     localRoot: __dirname,
//     useNodeModuleResolutionOnRelative: true,
//     verbose: true,
//   },
// }
// config.rules["import/no-absolute-path"] = ["off"]

module.exports = config

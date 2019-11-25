const { generateGlobalBundle } = require("@jsenv/bundling")
const { projectPath } = require("../../jsenv.config.js")

generateGlobalBundle({
  projectDirectoryPath: projectPath,
  entryPointMap: {
    "chromium-js-file": "./src/internal/chromium-launcher/chromium-js-file-template.js",
  },
  bundleDirectoryRelativePath: "./helpers/chromium",
})

const { prettierCheckProject, jsenvProjectFilesConfig } = require("@jsenv/prettier-check-project")
const jsenvConfig = require("../../jsenv.config.js")

prettierCheckProject({
  ...jsenvConfig,
  projectFilesConfig: {
    ...jsenvProjectFilesConfig,
    "./**/.jsenv/": false,
    "./**/dist/": false,
  },
})

const { prettierCheckProject, jsenvProjectFilesConfig } = require("@jsenv/prettier-check-project")
const jsenvConfig = require("../../jsenv.config.js")

prettierCheckProject({
  ...jsenvConfig,
  projectFilesConfig: {
    ...jsenvProjectFilesConfig,
    "./.github/": true,
    "./docs/": true,
    "./docs/**/node_modules/": false,
    "./helpers/": true,
    "./**/.jsenv/": false,
    "./**/dist/": false,
  },
})

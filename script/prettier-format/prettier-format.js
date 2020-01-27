/* global require */
const { formatWithPrettier, jsenvProjectFilesConfig } = require("@jsenv/prettier-check-project")
const jsenvConfig = require("../../jsenv.config.js")

formatWithPrettier({
  ...jsenvConfig,
  projectFilesConfig: {
    ...jsenvProjectFilesConfig,
    "./helpers/": true,
    "./**/coverage/": false,
    "./**/.jsenv/": false,
    "./**/dist/": false,
  },
})

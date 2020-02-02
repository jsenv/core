import { formatWithPrettier, jsenvProjectFilesConfig } from "@jsenv/prettier-check-project"
import * as jsenvConfig from "../../jsenv.config.js"

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

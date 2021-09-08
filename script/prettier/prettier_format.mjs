import { formatWithPrettier, jsenvProjectFilesConfig } from "@jsenv/prettier-check-project"

import { projectDirectoryUrl } from "../../jsenv.config.js"

await formatWithPrettier({
  projectDirectoryUrl,
  projectFilesConfig: {
    ...jsenvProjectFilesConfig,
    "./helpers/": true,
    "./**/coverage/": false,
    "./**/.jsenv/": false,
    "./**/dist/": false,
  },
})

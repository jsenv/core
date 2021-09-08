import { uploadCoverage } from "@jsenv/codecov-upload"

import { projectDirectoryUrl } from "../../jsenv.config.js"

await uploadCoverage({
  projectDirectoryUrl,
})

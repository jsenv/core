/* global __filename */

import { fileSystemPathToUrl, resolveUrl } from "@jsenv/filesystem"

let jsenvCoreDirectoryUrl
if (typeof __filename === "string") {
  jsenvCoreDirectoryUrl = resolveUrl(
    // get ride of dist/commonjs/main.js
    "../../",
    fileSystemPathToUrl(__filename),
  )
} else {
  jsenvCoreDirectoryUrl = resolveUrl(
    // get ride of src/internal/jsenvCoreDirectoryUrl.js
    "../../",
    import.meta.url,
  )
}

export { jsenvCoreDirectoryUrl }
